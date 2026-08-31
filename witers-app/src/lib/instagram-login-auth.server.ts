// "Connect your Instagram" via Meta's newer standalone Instagram login —
// the client authenticates with their own Instagram credentials, no
// Facebook Page required (unlike meta-publish-auth.server.ts, which is the
// classic Facebook-Login-based flow used to connect a Facebook Page). This
// uses a separate Meta app (INSTAGRAM_APP_ID/SECRET) with its own OAuth
// endpoints under instagram.com / graph.instagram.com. Server-only.
import process from "node:process";

const AUTH_ENDPOINT = "https://www.instagram.com/oauth/authorize";
const SHORT_TOKEN_ENDPOINT = "https://api.instagram.com/oauth/access_token";
const GRAPH_BASE = "https://graph.instagram.com/v21.0";

// content_publish for posting; business_basic for reading the account's own
// id/username right after connecting.
const SCOPE = "instagram_business_basic,instagram_business_content_publish";

type InstagramLoginConfig = { appId: string; appSecret: string };

export function getInstagramLoginConfig(): InstagramLoginConfig | { error: string } {
  // Cloudflare secrets pasted from a dashboard can occasionally include a
  // trailing newline or space. Neither is part of a Meta App ID/secret and
  // would make Instagram reject the authorization request before callback.
  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (!appId || !appSecret) return { error: "falta_instagram_config" };
  return { appId, appSecret };
}

export function instagramRedirectUri(origin: string): string {
  return `${origin}/api/social/connect/instagram/callback`;
}

export function buildInstagramAuthUrl(origin: string, state: string): string | { error: string } {
  const config = getInstagramLoginConfig();
  if ("error" in config) return config;
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", instagramRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

export type InstagramIdentity = { accessToken: string; igUserId: string; username: string };

export async function exchangeCodeForInstagramIdentity(
  code: string,
  origin: string,
): Promise<{ ok: true; data: InstagramIdentity } | { ok: false; error: string }> {
  const config = getInstagramLoginConfig();
  if ("error" in config) return { ok: false, error: config.error };

  // Step 1: short-lived token (~1h) + the account's own user id.
  let shortResponse: Response;
  try {
    shortResponse = await fetch(SHORT_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.appId,
        client_secret: config.appSecret,
        grant_type: "authorization_code",
        redirect_uri: instagramRedirectUri(origin),
        code,
      }),
    });
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  }
  // Instagram returns user_id as a raw JSON number, not a quoted string —
  // and it's a 17+ digit id, well past Number.MAX_SAFE_INTEGER, so
  // JSON.parse (via response.json()) silently rounds it and corrupts it
  // (Meta then rejects publish calls with "Object with ID '...0' does not
  // exist"). Pull the digits straight out of the response text instead, so
  // it's never round-tripped through a JS number.
  const shortText = await shortResponse.text();
  const shortJson = (() => {
    try {
      return JSON.parse(shortText) as { access_token?: string; error_message?: string };
    } catch {
      return {};
    }
  })();
  const userIdMatch = shortText.match(/"user_id"\s*:\s*(\d+)/);
  const userId = userIdMatch?.[1];
  if (!shortResponse.ok || !shortJson.access_token || !userId) {
    console.info("[instagram-login-auth] short token exchange failed", shortJson.error_message);
    return { ok: false, error: "intercambio_fallido" };
  }

  // Step 2: trade it for a long-lived token (~60 days). Unversioned path —
  // this one endpoint lives directly under graph.instagram.com, unlike the
  // v21.0-scoped ones below.
  const longUrl = new URL("https://graph.instagram.com/access_token");
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", config.appSecret);
  longUrl.searchParams.set("access_token", shortJson.access_token);

  let longResponse: Response;
  try {
    longResponse = await fetch(longUrl.toString());
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  }
  const longJson = (await longResponse.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!longResponse.ok || !longJson.access_token) {
    console.info("[instagram-login-auth] long-lived exchange failed", longJson.error?.message);
    return { ok: false, error: "intercambio_fallido" };
  }

  // Step 3: username, for a friendlier label than the raw numeric id.
  const meUrl = new URL(`${GRAPH_BASE}/me`);
  meUrl.searchParams.set("fields", "user_id,username");
  meUrl.searchParams.set("access_token", longJson.access_token);
  let username = userId;
  try {
    const meResponse = await fetch(meUrl.toString());
    const meJson = (await meResponse.json().catch(() => ({}))) as { username?: string };
    if (meJson.username) username = meJson.username;
  } catch {
    // Keep the numeric id as a fallback label — not fatal.
  }

  return {
    ok: true,
    data: { accessToken: longJson.access_token, igUserId: userId, username },
  };
}
