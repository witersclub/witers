import process from "node:process";

const VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;
const AUTH = `https://www.facebook.com/${VERSION}/dialog/oauth`;

function config() {
  const appId = process.env.META_PUBLISH_APP_ID;
  const appSecret = process.env.META_PUBLISH_APP_SECRET;
  return appId && appSecret ? { appId, appSecret } : null;
}

export function metaAdAccountRedirectUri(origin: string) {
  return `${origin}/api/meta/ad-account/callback`;
}

export function buildMetaAdAccountAuthUrl(origin: string, state: string): string | null {
  const value = config();
  if (!value) return null;
  const url = new URL(AUTH);
  url.searchParams.set("client_id", value.appId);
  url.searchParams.set("redirect_uri", metaAdAccountRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "ads_read,ads_management,business_management");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeMetaAdAccountCode(code: string, origin: string) {
  const value = config();
  if (!value) return { ok: false as const, error: "falta_config" };
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", value.appId);
  url.searchParams.set("client_secret", value.appSecret);
  url.searchParams.set("redirect_uri", metaAdAccountRedirectUri(origin));
  url.searchParams.set("code", code);
  const response = await fetch(url);
  const data = (await response.json().catch(() => ({}))) as { access_token?: string };
  if (!response.ok || !data.access_token) {
    return { ok: false as const, error: "intercambio_fallido" };
  }
  // Exchange the short-lived login token for the long-lived user token Meta
  // provides for server integrations. It remains encrypted at rest and is
  // used only for this user's selected advertising account.
  const longUrl = new URL(`${GRAPH}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", value.appId);
  longUrl.searchParams.set("client_secret", value.appSecret);
  longUrl.searchParams.set("fb_exchange_token", data.access_token);
  const longResponse = await fetch(longUrl);
  const longData = (await longResponse.json().catch(() => ({}))) as { access_token?: string };
  return {
    ok: true as const,
    token: longResponse.ok && longData.access_token ? longData.access_token : data.access_token,
  };
}

export async function listAccessibleAdAccounts(token: string) {
  const url = new URL(`${GRAPH}/me/adaccounts`);
  url.searchParams.set("fields", "account_id,name,account_status,currency");
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", token);
  const response = await fetch(url);
  const data = (await response.json().catch(() => ({}))) as {
    data?: Array<{ account_id: string; name: string; account_status?: number; currency?: string }>;
  };
  return response.ok && data.data
    ? { ok: true as const, accounts: data.data }
    : { ok: false as const, error: "cuentas_no_disponibles" };
}
