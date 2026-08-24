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
            `SELECT u.id, u.email, u.name, u.created_at, u.public_showcase,
                    m.status AS membership_status, m.plan AS membership_plan,
                    m.requests_quota, m.requests_used, m.bonus_requests_quota, m.activated_at,
                    (SELECT COALESCE(SUM(p.amount_mxn), 0) FROM payments p WHERE p.user_id = u.id AND p.status = 'paid') AS total_paid_mxn,
                    bp.company_name AS brand_company_name, bp.brand_colors AS brand_colors,
                    bp.business_type AS brand_business_type, bp.logo_key AS brand_logo_key,
                    bp.font_keys AS brand_font_keys, bp.library_font AS brand_library_font,
                    bp.meta_page_id AS brand_meta_page_id, bp.meta_ad_account_id AS brand_meta_ad_account_id
             FROM users u
             LEFT JOIN memberships m ON m.user_id = u.id
             LEFT JOIN brand_profiles bp ON bp.user_id = u.id
             ORDER BY u.created_at DESC
             LIMIT 500`,
          )
          .all();

        const requests = await db()
          .prepare(
            `SELECT r.*, u.email AS user_email, u.name AS user_name, d.name AS claimed_by_name,
               (SELECT json_group_array(json_object('id', res.id, 'kind', res.kind, 'image_url', res.image_url, 'r2_key', res.r2_key, 'created_at', res.created_at))
                FROM request_results res WHERE res.request_id = r.id) AS results_json
             FROM design_requests r
             JOIN users u ON u.id = r.user_id
             LEFT JOIN users d ON d.id = r.claimed_by
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

        const designers = await db()
          .prepare(
            `SELECT u.id, u.email, u.name, u.created_at,
                    (SELECT COUNT(*) FROM design_requests r WHERE r.claimed_by = u.id) AS claimed_count,
                    (SELECT COUNT(*) FROM design_requests r WHERE r.claimed_by = u.id AND r.status = 'completada') AS completed_count
             FROM users u
             WHERE u.role = 'designer' AND u.active = 1
             ORDER BY u.created_at DESC`,
          )
          .all();

        const discountCodes = await db()
          .prepare(`SELECT * FROM discount_codes ORDER BY created_at DESC LIMIT 200`)
          .all();

        return json({
          ok: true,
          users: users.results ?? [],
          requests: requests.results ?? [],
          payments: payments.results ?? [],
          designers: designers.results ?? [],
          discountCodes: discountCodes.results ?? [],
        });
      },
    },
  },
});
