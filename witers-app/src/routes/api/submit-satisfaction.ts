import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { notifyStaffLowSatisfaction } from "../../lib/mail.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  requestId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(1000).optional(),
});

// Client-only: satisfaction survey shown right after downloading the final
// piece. One rating per request — the panel hides the survey once submitted.
export const Route = createFileRoute("/api/submit-satisfaction")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const row = await db()
          .prepare("SELECT title FROM design_requests WHERE id = ?1 AND user_id = ?2")
          .bind(parsed.data.requestId, user.id)
          .first<{ title: string }>();
        if (!row) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });

        const feedback = parsed.data.feedback?.trim() || null;

        await db()
          .prepare(
            `UPDATE design_requests
             SET satisfaction_rating = ?2, satisfaction_feedback = ?3, satisfaction_submitted_at = datetime('now')
             WHERE id = ?1`,
          )
          .bind(parsed.data.requestId, parsed.data.rating, feedback)
          .run();

        if (parsed.data.rating < 5) {
          await notifyStaffLowSatisfaction({
            title: row.title,
            clientName: user.name,
            rating: parsed.data.rating,
            feedback,
            panelUrl: "https://witers.com/witer",
          });
        }

        return json({ ok: true });
      },
    },
  },
});
