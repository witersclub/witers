import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile } from "../../../lib/brand-profile.server";
import { getPlanningBrandAssets } from "../../../lib/brand-assets.server";
import { getBrandMemory } from "../../../lib/brand-memory.server";
import { runWitCalendarChat } from "../../../lib/wit-chat.server";
import { db, getSessionUser, json } from "../../../lib/witers-auth.server";
import { getPlan } from "../../../lib/membership-plans";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .min(1)
    .max(60),
  // The month the client actually has open in Planificación (from the
  // panel's month arrows) — optional, defaults to the server's real current
  // month. Without this, Wit always planned "today's real month" no matter
  // which month the client navigated to, so a client trying to plan ahead
  // for next month kept getting this month's plan back instead.
  year: z.number().int().min(2020).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  brandAssetIds: z.array(z.string().uuid()).max(30).optional(),
  expectedEntries: z.number().int().min(1).max(60).optional(),
  // The guided planner selects real calendar days before invoking Wit. This
  // keeps frequency a user decision instead of making the model infer it.
  plannedDates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .min(1)
    .max(60)
    .optional(),
});

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthContext(target: { year: number; month: number }): {
  monthLabel: string;
  todayDate: string;
  monthEndDate: string;
} {
  const now = new Date();
  const { year, month } = target;
  const monthStartDate = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const monthLabel = monthStartDate.toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const todayIso = iso(now);
  const monthStartIso = iso(monthStartDate);
  const monthEndIso = iso(monthEnd);
  // Earliest date Wit is allowed to propose: today, but only when today
  // actually falls inside the target month — a future month has no "today"
  // constraint (starts from day 1), and a past month gets no constraint
  // either (nothing left to plan going forward in it).
  const lowerBound = todayIso < monthStartIso || todayIso > monthEndIso ? monthStartIso : todayIso;
  return { monthLabel, todayDate: lowerBound, monthEndDate: monthEndIso };
}

function datesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cursor <= last) {
    dates.push(iso(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function batches<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    result.push(items.slice(index, index + size));
  return result;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await task(items[index]);
      }
    }),
  );
  return results;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Same shape as /api/wit/chat and /api/wit/carousel-chat, but guides the
// client toward planning the whole month's content calendar at once instead
// of one piece — see runWitCalendarChat.
export const Route = createFileRoute("/api/wit/calendar-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const profile = await getBrandProfile(user.id);
        if (!profile) return json({ ok: false, error: "falta_marca" }, { status: 409 });
        const membership = await db()
          .prepare("SELECT plan FROM memberships WHERE user_id = ?1")
          .bind(user.id)
          .first<{ plan: string }>();
        const plan = getPlan(membership?.plan);

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const now = new Date();
        const year = parsed.data.year ?? now.getUTCFullYear();
        const month = parsed.data.month ?? now.getUTCMonth() + 1;
        const pad = (n: number) => String(n).padStart(2, "0");
        const monthStart = `${year}-${pad(month)}-01`;
        const monthEndDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const monthEnd = `${year}-${pad(month)}-${pad(monthEndDay)}`;

        // Pieces the client already planned this month (usually the ones
        // "Replanear mes" left untouched because they're already requested)
        // — Wit needs these so a re-plan fills in the REST of the month
        // instead of proposing a date that's already taken.
        const existingRows = await db()
          .prepare(
            `SELECT scheduled_date, title FROM calendar_entries
             WHERE user_id = ?1 AND scheduled_date BETWEEN ?2 AND ?3
             ORDER BY scheduled_date ASC`,
          )
          .bind(user.id, monthStart, monthEnd)
          .all<{ scheduled_date: string; title: string }>();

        const existingEntries = existingRows.results ?? [];
        // `expectedEntries` represents the user's intent to fill the whole
        // month. It must not ask Wit to recreate dates that are already on
        // the calendar: only the still-empty dates are required. Count dates
        // rather than rows so an exceptional day with more than one piece
        // does not make the remaining quota negative.
        const context = monthContext({ year, month });
        const occupiedDates = new Set(existingEntries.map((entry) => entry.scheduled_date));
        const requestedDates = parsed.data.plannedDates
          ? [...new Set(parsed.data.plannedDates)].filter(
              (date) => date >= context.todayDate && date <= context.monthEndDate,
            )
          : datesInRange(context.todayDate, context.monthEndDate);
        const remainingDates = parsed.data.expectedEntries
          ? requestedDates.filter((date) => !occupiedDates.has(date))
          : [];
        const remainingExpectedEntries = parsed.data.expectedEntries
          ? remainingDates.length
          : undefined;

        if (parsed.data.expectedEntries && remainingExpectedEntries === 0) {
          return json({
            ok: true,
            kind: "message" as const,
            text: "Tu calendario ya tiene contenido para todas las fechas de este mes.",
          });
        }

        const brand = {
          companyName: profile.company_name,
          brandColors: profile.brand_colors,
          businessType: profile.business_type,
          hasLogo: Boolean(profile.logo_key),
          brandMemory: await getBrandMemory(user.id),
          brandAssets: (await getPlanningBrandAssets(user.id, parsed.data.brandAssetIds)).map(
            (asset) => ({
              originalName: asset.original_name,
              kind: asset.kind,
              textContent: asset.text_content ? asset.text_content.slice(0, 6000) : null,
            }),
          ),
        };

        // The client asked for one complete monthly plan. We create its
        // detailed pieces concurrently in internal date-locked batches, then
        // return one single review payload only when every date is present.
        if (remainingExpectedEntries) {
          const knownEntries = existingEntries.map((entry) => ({
            date: entry.scheduled_date,
            title: entry.title,
          }));
          const results = await runWithConcurrency(
            batches(remainingDates, 5),
            2,
            async (exactDates) => {
              // Transient provider throttling must never surface as a red
              // chat error. Retry this isolated batch automatically.
              for (let attempt = 0; attempt < 3; attempt += 1) {
                const result = await runWitCalendarChat(parsed.data.messages, brand, {
                  ...context,
                  existingEntries: knownEntries,
                  expectedEntries: exactDates.length,
                  exactDates,
                  maxPostsPerDay: plan.planningSlotsPerDay,
                });
                if (
                  result.ok ||
                  !["limite_openai", "proveedor_openai", "tiempo_agotado"].includes(result.error)
                ) {
                  return result;
                }
                if (attempt < 2) await wait(700 * (attempt + 1));
              }
              return { ok: false as const, error: "limite_openai" };
            },
          );
          const failure = results.find((result) => !result.ok);
          if (failure && !failure.ok) {
            console.warn("[calendar-chat] monthly job batch failed", failure.error);
            return json(failure, { status: failure.error === "tiempo_agotado" ? 504 : 502 });
          }
          const entries = results.flatMap((result) =>
            result.ok && result.kind === "done" ? result.entries : [],
          );
          if (entries.length !== remainingDates.length) {
            return json({ ok: false, error: "plan_incompleto" }, { status: 502 });
          }
          return json({ ok: true, kind: "done" as const, entries });
        }

        const result = await runWitCalendarChat(parsed.data.messages, brand, {
          ...context,
          existingEntries: existingEntries.map((r) => ({ date: r.scheduled_date, title: r.title })),
          expectedEntries: remainingExpectedEntries || undefined,
          exactDates: remainingExpectedEntries ? remainingDates : undefined,
          maxPostsPerDay: plan.planningSlotsPerDay,
        });

        if (!result.ok) return json(result, { status: 502 });
        return json(result);
      },
    },
  },
});
