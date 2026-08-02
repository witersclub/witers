// Anonymous live-visitor tracking ("who's on the site right now" — see
// /api/visitor-heartbeat and /api/admin/live-visitors). Every browser gets
// this cookie on its first heartbeat, logged in or not — it's never tied to
// a session, just a stable id so repeat pings from the same browser upsert
// the same row instead of creating a new one each time.
const VISITOR_COOKIE = "wit_visitor";
const VISITOR_COOKIE_DAYS = 365;

export function readVisitorId(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${VISITOR_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export function visitorCookie(id: string): string {
  const maxAge = VISITOR_COOKIE_DAYS * 24 * 60 * 60;
  return `${VISITOR_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
