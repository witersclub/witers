import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  clearOnboardingDraft,
  getOnboardingDraft,
  saveOnboardingDraft,
} from "../../../lib/brand-profile.server";
import { getSessionUser, json } from "../../../lib/witers-auth.server";

const saveSchema = z.object({
  answers: z.record(z.string(), z.string().max(500)),
});

// Autosaves the mandatory brand-onboarding chat as it's answered, one
// answer at a time — so a client who abandons partway through and comes
// back later resumes exactly where they left off instead of retyping
// everything.
export const Route = createFileRoute("/api/onboarding/draft")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const answers = await getOnboardingDraft(user.id);
        return json({ ok: true, answers });
      },
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const parsed = saveSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        await saveOnboardingDraft(user.id, parsed.data.answers);
        return json({ ok: true });
      },
      // "Nueva conversación" — a client stuck on a bad answer (or a save
      // that failed for a reason retrying alone won't fix) can wipe the
      // autosaved draft and start the onboarding chat over from scratch.
      DELETE: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        await clearOnboardingDraft(user.id);
        return json({ ok: true });
      },
    },
  },
});
