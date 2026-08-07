import { createFileRoute } from "@tanstack/react-router";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

type RawEvent = {
  id: string;
  type: string;
  path: string;
  label: string | null;
  country: string | null;
  visitor_id: string | null;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  created_at: string;
};

export type ActivityEntry =
  | {
      kind: "session";
      id: string;
      userName: string | null;
      userRole: string | null;
      country: string | null;
      pageCount: number;
      lastPath: string;
      startedAt: string;
      endedAt: string;
    }
  | {
      kind: "click";
      id: string;
      type: "whatsapp_click" | "cta_click";
      label: string | null;
      path: string;
      country: string | null;
      userName: string | null;
      userRole: string | null;
      createdAt: string;
    };

const PAGE_SIZE = 25;
// Raw rows pulled per request when grouping is involved — comfortably above
// this app's real traffic (tens of events/day), so pagination in practice
// never runs out mid-window. See the "clicks" filter below for the cheap
// path that skips all of this.
const RAW_CAP = 2000;
const SESSION_GAP_MS = 30 * 60 * 1000;

function eventTime(iso: string): number {
  return new Date(`${iso}Z`).getTime();
}

// Consecutive page_view rows from the same visitor (logged-in user_id, or
// anonymous visitor_id) within SESSION_GAP_MS of each other collapse into
// one "session" entry — this is what turns "47 rows of /, /, /, /pauta..."
// into "Visitante navegó 4 páginas, terminó en /pauta". Rows must already
// be sorted oldest-first for the gap check to make sense.
function groupPageViewsIntoSessions(rowsAsc: RawEvent[]): (ActivityEntry & { kind: "session" })[] {
  const openByVisitor = new Map<string, ActivityEntry & { kind: "session" }>();
  const sessions: (ActivityEntry & { kind: "session" })[] = [];

  for (const row of rowsAsc) {
    const key = row.user_id ?? row.visitor_id ?? row.id;
    const open = openByVisitor.get(key);
    if (open && eventTime(row.created_at) - eventTime(open.endedAt) <= SESSION_GAP_MS) {
      open.pageCount += 1;
      open.lastPath = row.path;
      open.endedAt = row.created_at;
      if (row.country) open.country = row.country;
      continue;
    }
    const fresh: ActivityEntry & { kind: "session" } = {
      kind: "session",
      id: row.id,
      userName: row.user_name,
      userRole: row.user_role,
      country: row.country,
      pageCount: 1,
      lastPath: row.path,
      startedAt: row.created_at,
      endedAt: row.created_at,
    };
    openByVisitor.set(key, fresh);
    sessions.push(fresh);
  }
  return sessions;
}

function clicksToEntries(rowsAsc: RawEvent[]): (ActivityEntry & { kind: "click" })[] {
  return rowsAsc
    .filter(
      (r): r is RawEvent & { type: "whatsapp_click" | "cta_click" } =>
        r.type === "whatsapp_click" || r.type === "cta_click",
    )
    .map((r) => ({
      kind: "click",
      id: r.id,
      type: r.type,
      label: r.label,
      path: r.path,
      country: r.country,
      userName: r.user_name,
      userRole: r.user_role,
      createdAt: r.created_at,
    }));
}

function entryTime(e: ActivityEntry): number {
  return eventTime(e.kind === "session" ? e.endedAt : e.createdAt);
}

// Feed for the admin "Actividad" tab — the individual "who did what, where,
// when" log behind the aggregate cards above it in Indicadores. Page views
// are grouped into per-visitor sessions (see groupPageViewsIntoSessions);
// WhatsApp/CTA clicks stay one row each since they're rare and each one
// matters. filter=clicks skips grouping entirely and paginates site_events
// directly — cheap, and the only case this app's admin looks at by default.
export const Route = createFileRoute("/api/admin/site-events-feed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const url = new URL(request.url);
        const filterParam = url.searchParams.get("filter");
        const filter =
          filterParam === "page_view" || filterParam === "all" ? filterParam : "clicks";
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

        if (filter === "clicks") {
          const rows = await db()
            .prepare(
              `SELECT e.id, e.type, e.path, e.label, e.country, e.visitor_id, e.user_id,
                 u.name AS user_name, u.role AS user_role, e.created_at
               FROM site_events e
               LEFT JOIN users u ON u.id = e.user_id
               WHERE e.type IN ('whatsapp_click', 'cta_click')
               ORDER BY e.created_at DESC, e.id DESC
               LIMIT ?1 OFFSET ?2`,
            )
            .bind(PAGE_SIZE + 1, offset)
            .all<RawEvent>();

          const results = rows.results ?? [];
          const entries = clicksToEntries(results.slice(0, PAGE_SIZE));
          return json({ ok: true, entries, hasMore: results.length > PAGE_SIZE });
        }

        const typeClause = filter === "page_view" ? "AND e.type = 'page_view'" : "";
        const rawDesc = await db()
          .prepare(
            `SELECT e.id, e.type, e.path, e.label, e.country, e.visitor_id, e.user_id,
               u.name AS user_name, u.role AS user_role, e.created_at
             FROM site_events e
             LEFT JOIN users u ON u.id = e.user_id
             WHERE 1=1 ${typeClause}
             ORDER BY e.created_at DESC, e.id DESC
             LIMIT ?1`,
          )
          .bind(RAW_CAP)
          .all<RawEvent>();

        const rowsAsc = (rawDesc.results ?? []).slice().reverse();
        const sessions = groupPageViewsIntoSessions(rowsAsc.filter((r) => r.type === "page_view"));
        const entries: ActivityEntry[] =
          filter === "all" ? [...sessions, ...clicksToEntries(rowsAsc)] : sessions;
        entries.sort((a, b) => entryTime(b) - entryTime(a));

        const page = entries.slice(offset, offset + PAGE_SIZE);
        return json({ ok: true, entries: page, hasMore: entries.length > offset + PAGE_SIZE });
      },
    },
  },
});
