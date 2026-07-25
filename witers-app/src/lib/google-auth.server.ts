// "Sign in with Google" for WITERS — an alternative to the email/password
// flow in witers-auth.server.ts, not a replacement: an account can be
// created or logged into by either path, matched by email. Server-only.
import process from "node:process";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

type GoogleConfig = {
  clientId: string;
  clientSecret: string;
};

export function getGoogleConfig(): GoogleConfig | { error: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { error: "falta_google_config" };
  return { clientId, clientSecret };
}

// Where Google sends the browser back to after consent — computed from the
// request's own origin rather than hardcoded, so it works on whatever
// domain is actually serving the request (must still be registered as an
// authorized redirect URI in the Google Cloud OAuth client either way).
export function googleRedirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl(origin: string, state: string): string | { error: string } {
  const config = getGoogleConfig();
  if ("error" in config) return config;
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", googleRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  // Always show the account chooser — a client on a shared computer
  // shouldn't get silently signed in as whoever used Google last here.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

// Decodes the id_token's payload without independently re-verifying its
// signature — acceptable here because the token isn't arriving from an
// untrusted party, it's the direct response (over TLS, authenticated with
// our client secret) from Google's own token endpoint in exchangeCode
// below, not something a client could forge and hand us.
function decodeIdTokenPayload(idToken: string): Record<string, unknown> | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function exchangeCodeForIdentity(
  code: string,
  origin: string,
): Promise<{ ok: true; data: GoogleIdentity } | { ok: false; error: string }> {
  const config = getGoogleConfig();
  if ("error" in config) return { ok: false, error: config.error };

  const form = new URLSearchParams();
  form.set("client_id", config.clientId);
  form.set("client_secret", config.clientSecret);
  form.set("code", code);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", googleRedirectUri(origin));

  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  }

  const json = (await response.json().catch(() => ({}))) as {
    id_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !json.id_token) {
    console.info("[google-auth] token exchange failed", json.error, json.error_description);
    return { ok: false, error: "intercambio_fallido" };
  }

  const payload = decodeIdTokenPayload(json.id_token);
  if (!payload) return { ok: false, error: "token_invalido" };

  const iss = payload.iss;
  if (iss !== "https://accounts.google.com" && iss !== "accounts.google.com") {
    return { ok: false, error: "emisor_invalido" };
  }
  if (payload.aud !== config.clientId) return { ok: false, error: "audiencia_invalida" };
  if (payload.email_verified !== true) return { ok: false, error: "correo_no_verificado" };
  if (typeof payload.email !== "string" || typeof payload.sub !== "string") {
    return { ok: false, error: "token_incompleto" };
  }

  return {
    ok: true,
    data: {
      sub: payload.sub,
      email: payload.email.trim().toLowerCase(),
      emailVerified: true,
      name:
        typeof payload.name === "string" && payload.name.trim()
          ? payload.name.trim()
          : payload.email,
    },
  };
}
