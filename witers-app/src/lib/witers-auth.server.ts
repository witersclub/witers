// WITERS in-app auth: PBKDF2 password hashing + D1-backed sessions.
// Server-only module.
import type { D1Database } from "@cloudflare/workers-types";

import { bindings } from "./bindings.server";

const SESSION_COOKIE = "wit_session";
const SESSION_DAYS = 30;

// ---------- crypto helpers ----------

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations: 100_000 },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return { hash, salt: toHex(salt.buffer as ArrayBuffer) };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const hash = await pbkdf2(password, fromHex(salt));
  if (hash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return diff === 0;
}

// ---------- db ----------

export function db(): D1Database {
  const { DB } = bindings();
  if (!DB) throw new Error("D1 binding missing");
  return DB;
}

export type MemberUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
};

export type Membership = {
  id: string;
  user_id: string;
  status: string;
  plan: string;
  price_mxn: number;
  // One shared monthly pool across imagen/video/carrusel — see
  // membership-plans.ts. The DB still carries the retired
  // video_requests_quota/carousel_requests_quota/*_used columns (never
  // dropped, just no longer read) from when each format had its own cap.
  requests_quota: number;
  requests_used: number;
  bonus_requests_quota: number;
  activated_at: string | null;
};

// ---------- cookies ----------

export function readSessionToken(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// ---------- sessions ----------

export async function createSession(userId: string): Promise<{ token: string; maxAge: number }> {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const maxAge = SESSION_DAYS * 24 * 3600;
  const expires = new Date(Date.now() + maxAge * 1000).toISOString();
  await db()
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?1, ?2, ?3)")
    .bind(token, userId, expires)
    .run();
  return { token, maxAge };
}

export async function destroySession(token: string): Promise<void> {
  await db().prepare("DELETE FROM sessions WHERE id = ?1").bind(token).run();
}

export async function getSessionUser(request: Request): Promise<MemberUser | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const row = await db()
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?1 AND s.expires_at > datetime('now') AND u.active = 1`,
    )
    .bind(token)
    .first<MemberUser>();
  return row ?? null;
}

export async function getMembership(userId: string): Promise<Membership | null> {
  const row = await db()
    .prepare("SELECT * FROM memberships WHERE user_id = ?1")
    .bind(userId)
    .first<Membership>();
  return row ?? null;
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

// Admin auth: the session user must have role = 'admin' in the users table.
// Promote your own account once with:
//   UPDATE users SET role = 'admin' WHERE email = 'tu@correo.com';
export async function requireAdminUser(
  request: Request,
): Promise<{ ok: true; user: MemberUser } | { ok: false; status: number; body: unknown }> {
  const user = await getSessionUser(request);
  if (!user) return { ok: false, status: 401, body: { ok: false, error: "no_sesion" } };
  if (user.role !== "admin") {
    return { ok: false, status: 403, body: { ok: false, error: "no_admin" } };
  }
  return { ok: true, user };
}

// Staff auth: admin OR designer — for the shared design-request workflow
// (claim, deliver, update status). Designer accounts are created by an
// admin directly (role = 'designer'), never self-registered.
export async function requireStaffUser(
  request: Request,
): Promise<{ ok: true; user: MemberUser } | { ok: false; status: number; body: unknown }> {
  const user = await getSessionUser(request);
  if (!user) return { ok: false, status: 401, body: { ok: false, error: "no_sesion" } };
  if (user.role !== "admin" && user.role !== "designer") {
    return { ok: false, status: 403, body: { ok: false, error: "no_autorizado" } };
  }
  return { ok: true, user };
}
