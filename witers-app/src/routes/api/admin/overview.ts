import { createFileRoute } from "@tanstack/react-router";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

export const Route = createFileRoute("/api/admin/overview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json({ ok: false, error: "no_admin" }, { status: auth.status });

        const users = await db()
          .prepare(
            `SELECT u.id, u.email, u.name, u.created_at,
                    m.status AS membership_status, m.requests_quota, m.requests_used, m.activated_at,
                    (SELECT COALESCE(SUM(p.amount_mxn), 0) FROM payments p WHERE p.user_id = u.id AND p.status = 'paid') AS total_paid_mxn
             FROM users u
             LEFT JOIN memberships m ON m.user_id = u.id
             ORDER BY u.created_at DESC
             LIMIT 500`,
          )
          .all();

        const requests = await db()
          .prepare(
            `SELECT r.*, u.email AS user_email, u.name AS user_name,
               (SELECT json_group_array(json_object('id', res.id, 'kind', res.kind, 'image_url', res.image_url, 'r2_key', res.r2_key))
                FROM request_results res WHERE res.request_id = r.id) AS results_json
             FROM design_requests r
             JOIN users u ON u.id = r.user_id
             ORDER BY r.created_at DESC
             LIMIT 500`,
          )
          .all();

        const payments = await db()
          .prepare(
            `SELECT p.*, u.email AS user_email FROM payments p
             JOIN users u ON u.id = p.user_id
             ORDER BY p.created_at DESC LIMIT 200`,
          )
          .all();

        return json({
          ok: true,
          users: users.results ?? [],
          requests: requests.results ?? [],
          payments: payments.results ?? [],
        });
      },
    },
  },
});

