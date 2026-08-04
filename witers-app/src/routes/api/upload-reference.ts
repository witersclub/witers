import { createFileRoute } from "@tanstack/react-router";

import { bindings } from "../../lib/bindings.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

// 15MB (not the usual 8) to leave room for a real brand-manual PDF, which
// tends to run heavier than a plain reference image.
const MAX_BYTES = 15 * 1024 * 1024;
// application/pdf covers the "Manual de marca" upload in the panel's
// "Activos de marca" section — everything else here is a reference image.
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
// Optional brand font files (onboarding's FontUploadPicker) are matched by
// filename extension instead of MIME type — browsers report wildly
// inconsistent (and sometimes empty) content-types for fonts, unlike the
// image/PDF types above where file.type is reliable. Widening ALLOWED_MIME
// with something like application/octet-stream to cover that would accept
// any file at all, defeating the whitelist; extension-matching keeps this
// endpoint's guarantee intact for every other caller.
const FONT_EXT = /\.(ttf|otf|woff2?)$/i;
const FONT_CONTENT_TYPE: Record<string, string> = {
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

export const Route = createFileRoute("/api/upload-reference")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const { STORAGE } = bindings();
        if (!STORAGE) return json({ ok: false, error: "sin_storage" }, { status: 500 });

        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) {
          return json({ ok: false, error: "archivo_faltante" }, { status: 400 });
        }
        const fontExtMatch = file.name.match(FONT_EXT);
        if (!ALLOWED_MIME.includes(file.type) && !fontExtMatch) {
          return json({ ok: false, error: "tipo_no_permitido" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return json({ ok: false, error: "muy_grande" }, { status: 400 });
        }

        const ext = fontExtMatch
          ? fontExtMatch[1].toLowerCase()
          : file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
              ? "webp"
              : file.type === "application/pdf"
                ? "pdf"
                : "jpg";
        const contentType = fontExtMatch ? FONT_CONTENT_TYPE[ext] : file.type;
        const key = `refs/${user.id}/${crypto.randomUUID()}.${ext}`;
        await STORAGE.put(key, (await file.arrayBuffer()) as ArrayBuffer, {
          httpMetadata: { contentType },
        });

        return json({ ok: true, key });
      },
    },
  },
});
