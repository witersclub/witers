// "Sign in with Facebook" for WITERS — an alternative to the email/password
// flow in witers-auth.server.ts, not a replacement: an account can be
// created or logged into by either path, matched by email. Server-only.
//
// This is a separate Facebook App/credential pair from META_ACCESS_TOKEN
// (meta-ads.server.ts) — that one is a Business System User token used to
// read a client's ad account data, unrelated to end users signing into
// their own WITERS account.
import process from "node:process";

const GRAPH_VERSION = "v21.0";
const AUTH_ENDPOINT = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const TOKEN_ENDPOINT = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
const ME_ENDPOINT = `https://graph.facebook.com/${GRAPH_VERSION}/me`;

type FacebookConfig = {
  appId: string;
  appSecret: string;
};

export function getFacebookConfig(): FacebookConfig | { error: string } {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) return { error: "falta_facebook_config" };
  return { appId, appSecret };
}

// Where Facebook sends the browser back to after consent — computed from
// the request's own origin rather than hardcoded, so it works on whatever
// domain is actually serving the request (must still be registered as a
// valid OAuth redirect URI in the Meta for Developers app either way).
export function facebookRedirectUri(origin: string): string {
  return `${origin}/api/auth/facebook/callback`;
}

export function buildFacebookAuthUrl(origin: string, state: string): string | { error: string } {
  const config = getFacebookConfig();
  if ("error" in config) return config;
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", facebookRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "email public_profile");
  url.searchParams.set("state", state);
  return url.toString();
}

export type FacebookIdentity = {
  id: string;
  email: string;
  name: string;
};

export async function exchangeCodeForIdentity(
  code: string,
  origin: string,
): Promise<{ ok: true; data: FacebookIdentity } | { ok: false; error: string }> {
  const config = getFacebookConfig();
  if ("error" in config) return { ok: false, error: config.error };

  const tokenUrl = new URL(TOKEN_ENDPOINT);
  tokenUrl.searchParams.set("client_id", config.appId);
  tokenUrl.searchParams.set("client_secret", config.appSecret);
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("redirect_uri", facebookRedirectUri(origin));

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(tokenUrl.toString());
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  }

  const tokenJson = (await tokenResponse.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!tokenResponse.ok || !tokenJson.access_token) {
    console.info("[facebook-auth] token exchange failed", tokenJson.error?.message);
    return { ok: false, error: "intercambio_fallido" };
  }

  const meUrl = new URL(ME_ENDPOINT);
  meUrl.searchParams.set("fields", "id,name,email");
  meUrl.searchParams.set("access_token", tokenJson.access_token);

  let meResponse: Response;
  try {
    meResponse = await fetch(meUrl.toString());
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  }

  const me = (await meResponse.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    email?: string;
    error?: { message?: string };
  };
  if (!meResponse.ok || !me.id) {
    console.info("[facebook-auth] /me failed", me.error?.message);
    return { ok: false, error: "perfil_invalido" };
  }
  // Facebook only returns email if the account has one and the client
  // granted the "email" permission — unlike Google, this isn't guaranteed
  // just from requesting the scope. Our accounts are matched by email, so
  // there's no safe way to proceed without it.
  if (!me.email) {
    return { ok: false, error: "correo_no_disponible" };
  }

  return {
    ok: true,
    data: {
      id: me.id,
      email: me.email.trim().toLowerCase(),
      name: me.name?.trim() || me.email,
    },
  };
}
