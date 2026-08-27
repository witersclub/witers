import { createFileRoute } from "@tanstack/react-router";

import {
  exchangeCodeForLongLivedToken,
  listManagedPages,
} from "../../../../lib/meta-publish-auth.server";
import { upsertSocialConnection } from "../../../../lib/social-connections.server";
import { encryptToken } from "../../../../lib/token-crypto.server";
import { db, getSessionUser } from "../../../../lib/witers-auth.server";

const CLEAR_STATE_COOKIE =
  "wit_social_oauth_state=; Path=/api/social/connect; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

function redirect(location: string): Response {
  const headers = new Headers({ location });
  headers.append("set-cookie", CLEAR_STATE_COOKIE);
  return new Response(null, { status: 302, headers });
}

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

type PendingPage = { id: string; name: string; ciphertext: string; iv: string };

// Meta lands the browser back here after the client authorizes the
// META_PUBLISH app. Saves the connected Page directly when the user
// manages exactly one Page; when they manage several, stashes the choice
// in social_connect_pending and sends the client to pick one
// (?social_pick=<id>) instead of guessing. Instagram is connected
// separately via /api/social/connect/instagram — nothing here touches it.
export const Route = createFileRoute("/api/social/connect/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return redirect("/ingresar");

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const cookieNonce = readCookie(request, "wit_social_oauth_state");
        if (!code || !state || !cookieNonce || state !== cookieNonce) {
          return redirect("/panel?social_error=1");
        }

        const tokenResult = await exchangeCodeForLongLivedToken(code, url.origin);
        if (!tokenResult.ok) return redirect("/panel?social_error=1");

        const pagesResult = await listManagedPages(tokenResult.accessToken);
        if (!pagesResult.ok) return redirect("/panel?social_error=1");
        if (pagesResult.pages.length === 0) return redirect("/panel?social_error=sin_paginas");

        if (pagesResult.pages.length === 1) {
          const page = pagesResult.pages[0];
          const { ciphertext, iv } = await encryptToken(page.accessToken);
          await upsertSocialConnection(
            user.id,
            "facebook",
            page.id,
            page.name,
            page.id,
            ciphertext,
            iv,
          );
          return redirect("/panel?social_connected=1");
        }

        const pending: PendingPage[] = [];
        for (const page of pagesResult.pages) {
          const { ciphertext, iv } = await encryptToken(page.accessToken);
          pending.push({ id: page.id, name: page.name, ciphertext, iv });
        }
        const pendingId = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO social_connect_pending (id, user_id, pages_json, expires_at)
             VALUES (?1, ?2, ?3, datetime('now', '+10 minutes'))`,
          )
          .bind(pendingId, user.id, JSON.stringify(pending))
          .run();

        return redirect(`/panel?social_pick=${pendingId}`);
      },
    },
  },
});
