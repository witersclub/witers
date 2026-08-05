import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile } from "../../lib/brand-profile.server";
import {
  type HelpChatMessage,
  type HelpUserContext,
  runHelpChat,
} from "../../lib/help-chat.server";
import { notifyStaffHelpEscalated } from "../../lib/mail.server";
import { db, getMembership, getSessionUser, json } from "../../lib/witers-auth.server";

const ESCALATION_REPLY = "Un experto se pondrá en contacto contigo en pocos minutos.";

const postSchema = z.union([
  z.object({ type: z.literal("message"), content: z.string().min(1).max(2000) }),
  z.object({ type: z.literal("escalate") }),
]);

type ConversationRow = {
  id: string;
  user_id: string;
  status: string;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "staff";
  content: string;
  created_at: string;
};

// A client's most recent non-"resuelta" conversation is reused across
// visits — closing the help chat and reopening it later (even a new
// session) picks up the same thread instead of starting fresh each time.
async function findOpenConversation(userId: string): Promise<ConversationRow | null> {
  const row = await db()
    .prepare(
      `SELECT * FROM help_conversations WHERE user_id = ?1 AND status != 'resuelta'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(userId)
    .first<ConversationRow>();
  return row ?? null;
}

async function getMessages(conversationId: string): Promise<MessageRow[]> {
  const rows = await db()
    .prepare("SELECT * FROM help_messages WHERE conversation_id = ?1 ORDER BY created_at ASC")
    .bind(conversationId)
    .all<MessageRow>();
  return rows.results ?? [];
}

async function buildUserContext(userId: string): Promise<HelpUserContext> {
  const [membership, brand] = await Promise.all([getMembership(userId), getBrandProfile(userId)]);
  return {
    companyName: brand?.company_name ?? null,
    membershipStatus: membership?.status ?? null,
    membershipPlan: membership?.plan ?? null,
    requestsRemaining: membership
      ? membership.requests_quota + membership.bonus_requests_quota - membership.requests_used
      : null,
    videoRequestsRemaining: membership
      ? membership.video_requests_quota - membership.video_requests_used
      : null,
    carouselRequestsRemaining: membership
      ? membership.carousel_requests_quota - membership.carousel_requests_used
      : null,
  };
}

export const Route = createFileRoute("/api/help-chat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const conversation = await findOpenConversation(user.id);
        if (!conversation) return json({ ok: true, conversation: null, messages: [] });

        return json({ ok: true, conversation, messages: await getMessages(conversation.id) });
      },

      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = postSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        let conversation = await findOpenConversation(user.id);
        if (!conversation) {
          const id = crypto.randomUUID();
          await db()
            .prepare("INSERT INTO help_conversations (id, user_id) VALUES (?1, ?2)")
            .bind(id, user.id)
            .run();
          conversation = await db()
            .prepare("SELECT * FROM help_conversations WHERE id = ?1")
            .bind(id)
            .first<ConversationRow>();
          if (!conversation) return json({ ok: false, error: "error_interno" }, { status: 500 });
        }

        if (parsed.data.type === "escalate") {
          await db()
            .prepare(
              "UPDATE help_conversations SET status = 'escalada', updated_at = datetime('now') WHERE id = ?1",
            )
            .bind(conversation.id)
            .run();
          conversation = { ...conversation, status: "escalada" };
          await db()
            .prepare(
              "INSERT INTO help_messages (id, conversation_id, role, content) VALUES (?1, ?2, 'assistant', ?3)",
            )
            .bind(crypto.randomUUID(), conversation.id, ESCALATION_REPLY)
            .run();

          const brand = await getBrandProfile(user.id);
          const userMessages = (await getMessages(conversation.id)).filter(
            (m) => m.role === "user",
          );
          await notifyStaffHelpEscalated({
            clientName: user.name,
            companyName: brand?.company_name ?? user.email,
            lastMessage: userMessages[userMessages.length - 1]?.content ?? "(sin mensajes previos)",
            adminUrl: "https://witers.com/admin",
          }).catch(() => {});

          return json({ ok: true, conversation, messages: await getMessages(conversation.id) });
        }

        await db()
          .prepare(
            "INSERT INTO help_messages (id, conversation_id, role, content) VALUES (?1, ?2, 'user', ?3)",
          )
          .bind(crypto.randomUUID(), conversation.id, parsed.data.content.trim())
          .run();
        await db()
          .prepare("UPDATE help_conversations SET updated_at = datetime('now') WHERE id = ?1")
          .bind(conversation.id)
          .run();

        // Once escalated, a real person is expected to reply — the AI stays
        // quiet so it doesn't talk over/undercut whoever picks it up.
        if (conversation.status === "escalada") {
          return json({ ok: true, conversation, messages: await getMessages(conversation.id) });
        }

        const history = await getMessages(conversation.id);
        const userContext = await buildUserContext(user.id);
        const chatHistory: HelpChatMessage[] = history
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        const result = await runHelpChat(chatHistory, userContext);
        if (result.ok) {
          await db()
            .prepare(
              "INSERT INTO help_messages (id, conversation_id, role, content) VALUES (?1, ?2, 'assistant', ?3)",
            )
            .bind(crypto.randomUUID(), conversation.id, result.text)
            .run();
        }

        return json({ ok: true, conversation, messages: await getMessages(conversation.id) });
      },
    },
  },
});
