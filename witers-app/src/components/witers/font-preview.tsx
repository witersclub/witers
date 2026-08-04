// Shared by panel.tsx (client's "Mi marca") and admin.tsx (staff's
// read-only view of a client's brand assets) — both need to render a
// client's uploaded font file(s) without duplicating the @font-face
// plumbing.
export function fontFormatFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "otf":
      return "opentype";
    case "woff":
      return "woff";
    case "woff2":
      return "woff2";
    default:
      return "truetype";
  }
}

// Renders `previewText` in a client's own uploaded font file(s) via an
// inline @font-face pulling straight from /api/file (the same
// authenticated R2 endpoint every other brand asset already uses — a font
// key looks like refs/{userId}/{uuid}.ttf, matched by its "owner or staff"
// rule same as the logo, so this works for both the client and staff with
// no extra plumbing). Up to two files register as weight 400/700 of one
// synthetic family, the normal way to give a single CSS font-family both a
// regular and bold cut.
export function CustomFontPreview({
  fontKeys,
  previewText,
  className,
}: {
  fontKeys: string[];
  previewText: string;
  className?: string;
}) {
  const family = "wit-custom-font-preview";
  const css = fontKeys
    .map(
      (key, i) =>
        `@font-face { font-family: "${family}"; src: url("/api/file?key=${encodeURIComponent(key)}") format("${fontFormatFromKey(key)}"); font-weight: ${i === 0 ? 400 : 700}; font-display: swap; }`,
    )
    .join("\n");
  return (
    <>
      <style>{css}</style>
      <p
        className={className ?? "truncate text-2xl font-bold text-wit-ink"}
        style={{ fontFamily: `"${family}", sans-serif` }}
      >
        {previewText}
      </p>
    </>
  );
}
