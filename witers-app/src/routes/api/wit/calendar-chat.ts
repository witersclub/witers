import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { buildBrandContext } from "../../../lib/brand-context.server";
import { runWitCalendarChat } from "../../../lib/wit-chat.server";
import { db, getSessionUser, json } from "../../../lib/witers-auth.server";
import { getPlan } from "../../../lib/membership-plans";
import {
  detectAllowedWeekdaysFromConversation,
  validatePlanningConstraints,
  type Weekday,
} from "../../../lib/planning-constraints.server";

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
  targetDates: z
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

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const brand = await buildBrandContext(user.id, {
          brandAssetIds: parsed.data.brandAssetIds,
          // A full month's entries share one prompt — cap each asset so a
          // long strategy doc can't crowd out the rest of the context.
          maxAssetChars: 6000,
        });
        if (!brand) return json({ ok: false, error: "falta_marca" }, { status: 409 });
        const membership = await db()
          .prepare("SELECT plan FROM memberships WHERE user_id = ?1")
          .bind(user.id)
          .first<{ plan: string }>();
        const plan = getPlan(membership?.plan);

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
        const suppliedDates = parsed.data.targetDates ?? parsed.data.plannedDates;
        // CAMBIO 07 — deterministic reading of "lunes a viernes"-type
        // constraints straight from the client's own words, independent of
        // whether the model correctly reflects them. Only applied to dates
        // WE computed (the full-month fallback below) — dates the client
        // already picked explicitly through the guided wizard's UI
        // (suppliedDates) are the more authoritative signal and are never
        // second-guessed by a text heuristic reading the same conversation.
        const explicitAllowedWeekdays = detectAllowedWeekdaysFromConversation(parsed.data.messages);
        const requestedDatesRaw = suppliedDates
          ? [...new Set(suppliedDates)].filter(
              (date) => date >= context.todayDate && date <= context.monthEndDate,
            )
          : datesInRange(context.todayDate, context.monthEndDate);
        const requestedDates =
          suppliedDates || !explicitAllowedWeekdays
            ? requestedDatesRaw
            : requestedDatesRaw.filter((date) =>
                explicitAllowedWeekdays.has(
                  new Date(`${date}T00:00:00.000Z`).getUTCDay() as Weekday,
                ),
              );
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
              // A model may complete only part of a detailed batch (most
              // often when a carousel omits one of its four slides). Keep
              // every valid date and ask only for the missing ones, never
              // discard a whole monthly plan because one item was malformed.
              const collected = new Map<
                string,
                {
                  date: string;
                  title: string;
                  format: "imagen" | "video" | "carrusel";
                  brief: string;
                  slot?: number;
                  slides?: { title: string; brief: string }[];
                }
              >();
              let missingDates = exactDates;
              for (let attempt = 0; attempt < 4 && missingDates.length; attempt += 1) {
                const result = await runWitCalendarChat(parsed.data.messages, brand.context, {
                  ...context,
                  existingEntries: knownEntries,
                  expectedEntries: missingDates.length,
                  exactDates: missingDates,
                  maxPostsPerDay: plan.planningSlotsPerDay,
                  allowPartial: true,
                });
                if (!result.ok) {
                  if (
                    !["limite_openai", "proveedor_openai", "tiempo_agotado"].includes(result.error)
                  ) {
                    return result;
                  }
                  if (attempt < 3) await wait(700 * (attempt + 1));
                  continue;
                }
                if (result.kind !== "done") {
                  if (attempt < 3) await wait(450 * (attempt + 1));
                  continue;
                }
                for (const entry of result.entries) collected.set(entry.date, entry);
                missingDates = exactDates.filter((date) => !collected.has(date));
                if (!missingDates.length) {
                  return {
                    ok: true as const,
                    kind: "done" as const,
                    entries: exactDates.map((date) => collected.get(date)!),
                  };
                }
                if (attempt < 3) await wait(450 * (attempt + 1));
              }
              if (missingDates.length) {
                console.warn("[calendar-chat] batch remained incomplete", {
                  expected: exactDates,
                  missing: missingDates,
                });
                return { ok: false as const, error: "plan_incompleto" };
              }
              return { ok: false as const, error: "plan_incompleto" };
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
          // Defense in depth: remainingDates was already weekday-filtered
          // above (unless the client supplied its own exact dates, which are
          // trusted as-is), so this should never actually drop anything —
          // but a validator that's only ever proven never to trigger isn't
          // proof it can't, and this is the last stop before persistence.
          const { valid: validatedEntries, violations: droppedEntries } =
            validatePlanningConstraints(entries, {
              allowedWeekdays: suppliedDates ? null : explicitAllowedWeekdays,
            });
          if (droppedEntries.length) {
            console.warn(
              "[calendar-chat] dropped entries outside allowed weekdays (batch path)",
              droppedEntries.map((entry) => entry.date),
            );
          }
          return json({ ok: true, kind: "done" as const, entries: validatedEntries });
        }

        const result = await runWitCalendarChat(parsed.data.messages, brand.context, {
          ...context,
          existingEntries: existingEntries.map((r) => ({ date: r.scheduled_date, title: r.title })),
          expectedEntries: remainingExpectedEntries || undefined,
          exactDates: remainingExpectedEntries ? remainingDates : undefined,
          maxPostsPerDay: plan.planningSlotsPerDay,
        });

        if (!result.ok) return json(result, { status: 502 });
        if (result.kind === "done" && explicitAllowedWeekdays) {
          const { valid: validatedEntries, violations: droppedEntries } =
            validatePlanningConstraints(result.entries, {
              allowedWeekdays: explicitAllowedWeekdays,
            });
          if (droppedEntries.length) {
            console.warn(
              "[calendar-chat] dropped entries outside allowed weekdays (free conversation)",
              droppedEntries.map((entry) => entry.date),
            );
          }
          return json({ ...result, entries: validatedEntries });
        }
        return json(result);
      },
    },
  },
});
