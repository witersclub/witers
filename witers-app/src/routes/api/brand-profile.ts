import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandAssets } from "../../lib/brand-assets.server";
import { getBrandProfile } from "../../lib/brand-profile.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const assetSchema = z.object({
  action: z.literal("add_asset"),
  key: z.string().min(1).max(500),
  originalName: z.string().min(1).max(200),
  kind: z.enum(["manual", "strategy", "reference", "product", "video"]).default("reference"),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().min(0).max(15 * 1024 * 1024),
  textContent: z.string().max(12000).nullable().optional(),
});
const toggleSchema = z.object({ action: z.literal("toggle_asset"), id: z.string().uuid(), enabled: z.boolean() });
const removeSchema = z.object({ action: z.literal("remove_asset"), id: z.string().uuid() });

export const Route = createFileRoute("/api/brand-profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const profile = await getBrandProfile(user.id);
        return json({ ok: true, profile, assets: await getBrandAssets(user.id) });
      },
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const parsed = assetSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        const a = parsed.data;
        await db().prepare(
          `INSERT INTO brand_assets (id, user_id, r2_key, original_name, kind, mime_type, size_bytes, text_content)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
        ).bind(crypto.randomUUID(), user.id, a.key, a.originalName, a.kind, a.mimeType, a.sizeBytes, a.textContent ?? null).run();
        return json({ ok: true });
      },
      PATCH: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const parsed = toggleSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        await db().prepare("UPDATE brand_assets SET use_in_planning = ?3 WHERE id = ?1 AND user_id = ?2")
          .bind(parsed.data.id, user.id, parsed.data.enabled ? 1 : 0).run();
        return json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const parsed = removeSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        await db().prepare("DELETE FROM brand_assets WHERE id = ?1 AND user_id = ?2").bind(parsed.data.id, user.id).run();
        return json({ ok: true });
      },
    },
  },
});
