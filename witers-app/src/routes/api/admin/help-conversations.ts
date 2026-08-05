import { createFileRoute } from "@tanstack/react-router";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

type ConversationListRow = {
  id: string;
  status: string;
  claimed_by: string | null;
  claimed_by_name: string | null;
  created_at: string;
  updated_at: string;
  client_name: string;
  client_email: string;
  company_name: string | null;
  last_message: string | null;
};

// Inbox list for the admin "Ayuda" tab — escalated conversations are what
// staff need to act on; the badge count in admin.tsx is just this list
// filtered to status = 'escalada' client-side, same pattern as
// needsAttentionCount for Solicitudes.
export const Route = createFileRoute("/api/admin/help-conversations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const rows = await db()
          .prepare(
            `SELECT c.id, c.status, c.claimed_by, c.created_at, c.updated_at,
               u.name AS client_name, u.email AS client_email,
               bp.company_name AS company_name,
               staff.name AS claimed_by_name,
               (SELECT m.content FROM help_messages m WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC LIMIT 1) AS last_message
             FROM help_conversations c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN brand_profiles bp ON bp.user_id = c.user_id
             LEFT JOIN users staff ON staff.id = c.claimed_by
             WHERE c.status != 'resuelta'
             ORDER BY (c.status = 'escalada') DESC, c.updated_at DESC`,
          )
          .all<ConversationListRow>();

        return json({ ok: true, conversations: rows.results ?? [] });
      },
    },
  },
});
