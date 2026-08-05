import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

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

const postSchema = z.union([
  z.object({
    conversationId: z.string().uuid(),
    action: z.literal("reply"),
    content: z.string().min(1).max(2000),
  }),
  z.object({ conversationId: z.string().uuid(), action: z.literal("resolve") }),
]);

async function getMessages(conversationId: string): Promise<MessageRow[]> {
  const rows = await db()
    .prepare("SELECT * FROM help_messages WHERE conversation_id = ?1 ORDER BY created_at ASC")
    .bind(conversationId)
    .all<MessageRow>();
  return rows.results ?? [];
}

// Full transcript (GET) + staff actions (POST: reply or mark resolved) for
// one conversation from the admin "Ayuda" tab — see help-conversations.ts
// for the inbox list this drills into.
export const Route = createFileRoute("/api/admin/help-conversation")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const conversationId = new URL(request.url).searchParams.get("conversationId") ?? "";
        const conversation = await db()
          .prepare("SELECT * FROM help_conversations WHERE id = ?1")
          .bind(conversationId)
          .first<ConversationRow>();
        if (!conversation) return json({ ok: false, error: "no_encontrada" }, { status: 404 });

        return json({ ok: true, conversation, messages: await getMessages(conversation.id) });
      },

      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = postSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        let conversation = await db()
          .prepare("SELECT * FROM help_conversations WHERE id = ?1")
          .bind(parsed.data.conversationId)
          .first<ConversationRow>();
        if (!conversation) return json({ ok: false, error: "no_encontrada" }, { status: 404 });

        if (parsed.data.action === "resolve") {
          await db()
            .prepare(
              "UPDATE help_conversations SET status = 'resuelta', updated_at = datetime('now') WHERE id = ?1",
            )
            .bind(conversation.id)
            .run();
          conversation = { ...conversation, status: "resuelta" };
          return json({ ok: true, conversation, messages: await getMessages(conversation.id) });
        }

        await db()
          .prepare(
            "INSERT INTO help_messages (id, conversation_id, role, content) VALUES (?1, ?2, 'staff', ?3)",
          )
          .bind(crypto.randomUUID(), conversation.id, parsed.data.content.trim())
          .run();

        // Auto-claim on first reply — same "who's handling this" idea as
        // design_requests.claimed_by, but without a separate "reclamar"
        // action since this is a support inbox, not a work queue.
        const claimSql = conversation.claimed_by
          ? "UPDATE help_conversations SET updated_at = datetime('now') WHERE id = ?2"
          : "UPDATE help_conversations SET claimed_by = ?1, claimed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?2";
        await db().prepare(claimSql).bind(auth.user.id, conversation.id).run();
        if (!conversation.claimed_by) {
          conversation = {
            ...conversation,
            claimed_by: auth.user.id,
            claimed_at: new Date().toISOString(),
          };
        }

        return json({ ok: true, conversation, messages: await getMessages(conversation.id) });
      },
    },
  },
});
