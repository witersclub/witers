// OAuth for connecting a client's own Instagram/Facebook account so WITERS
// can publish to it — a separate concern from both facebook-auth.server.ts
// ("Sign in with Facebook" into a WITERS account) and meta-ads.server.ts
// (the shared META_ACCESS_TOKEN used to read a client's ad account). This
// uses its own Meta App (META_PUBLISH_APP_ID/SECRET) with publish-capable
// scopes — restricted permissions Meta only grants to that App's own
// testers until it passes App Review. Server-only.
import process from "node:process";

const GRAPH_VERSION = "v21.0";
const AUTH_ENDPOINT = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const TOKEN_ENDPOINT = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// No business_management: the flow only ever touches Pages the connecting
// user already manages, listed via /me/accounts — nothing here needs
// Business Manager-level access.
const SCOPE =
  "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish";

type MetaPublishConfig = { appId: string; appSecret: string };

export function getMetaPublishConfig(): MetaPublishConfig | { error: string } {
  const appId = process.env.META_PUBLISH_APP_ID;
  const appSecret = process.env.META_PUBLISH_APP_SECRET;
  if (!appId || !appSecret) return { error: "falta_meta_publish_config" };
  return { appId, appSecret };
}

export function metaPublishRedirectUri(origin: string): string {
  return `${origin}/api/social/connect/callback`;
}

export function buildMetaPublishAuthUrl(origin: string, state: string): string | { error: string } {
  const config = getMetaPublishConfig();
  if ("error" in config) return config;
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", metaPublishRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

// Short-lived token from the code exchange, then immediately traded for a
// long-lived one (~60 days) — the extra round trip facebook-auth.server.ts
// doesn't need, since a WITERS login session doesn't hold onto that token.
export async function exchangeCodeForLongLivedToken(
  code: string,
  origin: string,
): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const config = getMetaPublishConfig();
  if ("error" in config) return { ok: false, error: config.error };

  const tokenUrl = new URL(TOKEN_ENDPOINT);
  tokenUrl.searchParams.set("client_id", config.appId);
  tokenUrl.searchParams.set("client_secret", config.appSecret);
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("redirect_uri", metaPublishRedirectUri(origin));

  let shortLived: Response;
  try {
    shortLived = await fetch(tokenUrl.toString());
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  }
  const shortJson = (await shortLived.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!shortLived.ok || !shortJson.access_token) {
    console.info("[meta-publish-auth] token exchange failed", shortJson.error?.message);
    return { ok: false, error: "intercambio_fallido" };
  }

  const longUrl = new URL(TOKEN_ENDPOINT);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", config.appId);
  longUrl.searchParams.set("client_secret", config.appSecret);
  longUrl.searchParams.set("fb_exchange_token", shortJson.access_token);

  let longLived: Response;
  try {
    longLived = await fetch(longUrl.toString());
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  }
  const longJson = (await longLived.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!longLived.ok || !longJson.access_token) {
    console.info("[meta-publish-auth] long-lived exchange failed", longJson.error?.message);
    return { ok: false, error: "intercambio_fallido" };
  }

  return { ok: true, accessToken: longJson.access_token };
}

export type ManagedPage = {
  id: string;
  name: string;
  accessToken: string;
  instagramUserId: string | null;
};

export async function listPagesWithInstagram(
  userAccessToken: string,
): Promise<{ ok: true; pages: ManagedPage[] } | { ok: false; error: string }> {
  const accountsUrl = new URL(`${GRAPH_BASE}/me/accounts`);
  accountsUrl.searchParams.set("fields", "id,name,access_token");
  accountsUrl.searchParams.set("access_token", userAccessToken);

  let accountsResponse: Response;
  try {
    accountsResponse = await fetch(accountsUrl.toString());
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  }
  const accountsJson = (await accountsResponse.json().catch(() => ({}))) as {
    data?: { id: string; name: string; access_token: string }[];
    error?: { message?: string };
  };
  if (!accountsResponse.ok || !accountsJson.data) {
    console.info("[meta-publish-auth] /me/accounts failed", accountsJson.error?.message);
    return { ok: false, error: "paginas_no_disponibles" };
  }

  const pages: ManagedPage[] = [];
  for (const page of accountsJson.data) {
    const igUrl = new URL(`${GRAPH_BASE}/${page.id}`);
    igUrl.searchParams.set("fields", "instagram_business_account");
    igUrl.searchParams.set("access_token", page.access_token);
    let instagramUserId: string | null = null;
    try {
      const igResponse = await fetch(igUrl.toString());
      const igJson = (await igResponse.json().catch(() => ({}))) as {
        instagram_business_account?: { id?: string };
      };
      instagramUserId = igJson.instagram_business_account?.id ?? null;
    } catch {
      // No Instagram linked, or the lookup failed — this Page still works
      // for Facebook publishing on its own, so this isn't fatal.
    }
    pages.push({ id: page.id, name: page.name, accessToken: page.access_token, instagramUserId });
  }

  return { ok: true, pages };
}
