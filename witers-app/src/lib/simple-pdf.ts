// A minimal, dependency-free PDF writer — builds the byte stream by hand
// (indirect objects, content streams, an xref table, trailer) instead of
// pulling in a PDF library. Deliberately scoped to what a branded report
// needs: text in the 14 standard fonts (no font embedding — WinAnsiEncoding
// covers every accented character Spanish text uses), simple filled
// rectangles and lines (table headers/borders), and JPEG images (a logo).
//
// This whole feature runs client-side in the browser — see
// campaign-report-pdf.ts — because the app's server runtime (Cloudflare
// Workers) has no headless browser or native libraries available, which
// rules out most of the usual server-side PDF approaches. A hand-built
// byte stream sidesteps needing any PDF library at all, client or server.

export type RGB = [number, number, number]; // each 0-1

const textEncoder = new TextEncoder();

function num(n: number): string {
  // Trim to 3 decimals and let toString() drop trailing zeros — PDF just
  // needs valid reals; all coordinates here are comfortably within the
  // range where toString() never switches to exponential notation.
  return (Math.round(n * 1000) / 1000).toString();
}

// WinAnsiEncoding (set on every font dict below) matches Unicode/Latin-1
// exactly for every code point below 256, which covers every character
// Spanish text needs (á é í ó ú ñ Ñ ¿ ¡ ü) — so encoding a string is just
// "take the low byte of each character," no real transcoding table needed.
// A handful of "smart" typographic characters sit outside Latin-1 but
// WinAnsiEncoding (== cp1252) still maps them, at these bytes — e.g. an
// en dash from date-range formatting ("1 ago – 5 ago"), or the ellipsis
// truncateToWidth() emits. Anything else above 0xFF falls back to '?'.
const WIN_ANSI_HIGH: Record<number, number> = {
  0x2013: 0x96, // – en dash
  0x2014: 0x97, // — em dash
  0x2018: 0x91, // ' left single quote
  0x2019: 0x92, // ' right single quote
  0x201c: 0x93, // " left double quote
  0x201d: 0x94, // " right double quote
  0x2026: 0x85, // … ellipsis
};

function winAnsiBytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 256) out.push(code);
    else out.push(WIN_ANSI_HIGH[code] ?? 0x3f); // '?' fallback outside Latin-1
  }
  return out;
}

function escapePdfStringBytes(bytes: number[]): number[] {
  const out: number[] = [];
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) out.push(0x5c); // \( \) \\
    out.push(b);
  }
  return out;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

// Builds one page's content stream — the sequence of drawing operators
// (BT/Tj for text, re/f for filled rects, m/l/S for lines, cm/Do for
// images). Pure byte assembly; text strings are encoded as raw WinAnsi
// bytes rather than run through TextEncoder, which would UTF-8-encode
// anything above ASCII (e.g. "é" as two bytes) and corrupt the string.
class ContentStreamBuilder {
  private parts: Uint8Array[] = [];

  op(s: string) {
    this.parts.push(textEncoder.encode(`${s}\n`));
  }

  showStringOp(s: string) {
    const bytes = escapePdfStringBytes(winAnsiBytes(s));
    this.parts.push(textEncoder.encode("("));
    this.parts.push(new Uint8Array(bytes));
    this.parts.push(textEncoder.encode(") Tj\n"));
  }

  build(): Uint8Array {
    return concatBytes(this.parts);
  }
}

// Low-level object/xref/trailer writer. Object numbers are allocated via
// reserve() independently of write order — writeObj() can be called for a
// reserved number at any later point, in any order, since cross-references
// between objects are just "N 0 R" regardless of where N ends up in the
// byte stream. This is what lets a Page object reference its Parent Pages
// object before the Pages object itself has been written.
class PdfObjWriter {
  private chunks: Uint8Array[] = [];
  private length = 0;
  private offsets: number[] = [];
  private nextNum = 1;

  constructor() {
    this.raw("%PDF-1.4\n");
  }

  private raw(s: string) {
    const bytes = textEncoder.encode(s);
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  private rawBytes(b: Uint8Array) {
    this.chunks.push(b);
    this.length += b.length;
  }

  reserve(): number {
    return this.nextNum++;
  }

  writeObj(objNum: number, body: { dict: string; stream?: Uint8Array }) {
    this.offsets[objNum] = this.length;
    this.raw(`${objNum} 0 obj\n`);
    if (body.stream) {
      const dictPart = body.dict ? `${body.dict} ` : "";
      this.raw(`<< ${dictPart}/Length ${body.stream.length} >>\nstream\n`);
      this.rawBytes(body.stream);
      this.raw("\nendstream\nendobj\n");
    } else {
      this.raw(`<< ${body.dict} >>\nendobj\n`);
    }
  }

  finish(rootNum: number): Uint8Array {
    const xrefStart = this.length;
    const total = this.nextNum; // objects 1..nextNum-1 are in use
    let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let i = 1; i < total; i++) {
      const off = this.offsets[i] ?? 0;
      xref += `${String(off).padStart(10, "0")} 00000 n \n`;
    }
    this.raw(xref);
    this.raw(`trailer\n<< /Size ${total} /Root ${rootNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
    return concatBytes(this.chunks);
  }
}

type RegisteredImage = { num: number; w: number; h: number };

export class PdfPage {
  private cs = new ContentStreamBuilder();
  private usedImages = new Set<string>();

  constructor(
    private pageWidth: number,
    private pageHeight: number,
    private images: Map<string, RegisteredImage>,
  ) {}

  // Every coordinate this class's public methods take is measured from the
  // TOP-LEFT of the page (natural for a top-down report layout) — PDF's own
  // coordinate system is bottom-left origin, so this flips once here rather
  // than making every call site do the math.
  private flipY(y: number): number {
    return this.pageHeight - y;
  }

  text(x: number, yFromTop: number, str: string, font: "F1" | "F2", size: number, color: RGB) {
    this.cs.op(`${num(color[0])} ${num(color[1])} ${num(color[2])} rg`);
    this.cs.op("BT");
    this.cs.op(`/${font} ${num(size)} Tf`);
    this.cs.op(`${num(x)} ${num(this.flipY(yFromTop))} Td`);
    this.cs.showStringOp(str);
    this.cs.op("ET");
  }

  // Filled rectangle, yFromTop is the rect's TOP edge.
  rect(x: number, yFromTop: number, w: number, h: number, color: RGB) {
    const yPdf = this.flipY(yFromTop) - h;
    this.cs.op(`${num(color[0])} ${num(color[1])} ${num(color[2])} rg`);
    this.cs.op(`${num(x)} ${num(yPdf)} ${num(w)} ${num(h)} re`);
    this.cs.op("f");
  }

  line(x1: number, y1FromTop: number, x2: number, y2FromTop: number, color: RGB, width = 1) {
    this.cs.op(`${num(color[0])} ${num(color[1])} ${num(color[2])} RG`);
    this.cs.op(`${num(width)} w`);
    this.cs.op(`${num(x1)} ${num(this.flipY(y1FromTop))} m`);
    this.cs.op(`${num(x2)} ${num(this.flipY(y2FromTop))} l`);
    this.cs.op("S");
  }

  // xFromTop/yFromTop is the image's top-left corner; w/h is the drawn
  // size on the page (independent of the image's own pixel dimensions —
  // the `cm` matrix scales a 1x1 unit square to w x h).
  image(key: string, xTop: number, yFromTop: number, w: number, h: number) {
    if (!this.images.has(key)) return;
    this.usedImages.add(key);
    const yPdf = this.flipY(yFromTop) - h;
    this.cs.op("q");
    this.cs.op(`${num(w)} 0 0 ${num(h)} ${num(xTop)} ${num(yPdf)} cm`);
    this.cs.op(`/${key} Do`);
    this.cs.op("Q");
  }

  usedImageKeys(): string[] {
    return [...this.usedImages];
  }

  contentBytes(): Uint8Array {
    return this.cs.build();
  }
}

export class SimplePdf {
  readonly pageWidth: number;
  readonly pageHeight: number;
  private writer = new PdfObjWriter();
  private catalogNum: number;
  private pagesNum: number;
  private helvNum: number;
  private helvBoldNum: number;
  private images = new Map<string, RegisteredImage>();
  private pages: PdfPage[] = [];

  constructor(pageWidth = 612, pageHeight = 792) {
    this.pageWidth = pageWidth;
    this.pageHeight = pageHeight;
    this.catalogNum = this.writer.reserve();
    this.pagesNum = this.writer.reserve();
    this.helvNum = this.writer.reserve();
    this.writer.writeObj(this.helvNum, {
      dict: "/Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding",
    });
    this.helvBoldNum = this.writer.reserve();
    this.writer.writeObj(this.helvBoldNum, {
      dict: "/Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding",
    });
  }

  // Registers a JPEG under `key` for use by any page's image() call —
  // embedded once even if drawn on multiple pages (e.g. a logo repeated in
  // a footer). `key` must be a simple ASCII token (used directly as the
  // PDF resource name), no spaces or slashes.
  registerJpeg(key: string, jpegBytes: Uint8Array, pixelWidth: number, pixelHeight: number) {
    if (this.images.has(key)) return;
    const objNum = this.writer.reserve();
    this.writer.writeObj(objNum, {
      dict: `/Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
      stream: jpegBytes,
    });
    this.images.set(key, { num: objNum, w: pixelWidth, h: pixelHeight });
  }

  addPage(): PdfPage {
    const page = new PdfPage(this.pageWidth, this.pageHeight, this.images);
    this.pages.push(page);
    return page;
  }

  build(): Uint8Array {
    const pageObjNums: number[] = [];
    for (const page of this.pages) {
      const contentNum = this.writer.reserve();
      this.writer.writeObj(contentNum, { dict: "", stream: page.contentBytes() });

      const xobjEntries = page
        .usedImageKeys()
        .map((k) => `/${k} ${this.images.get(k)!.num} 0 R`)
        .join(" ");
      const resources = `/Font << /F1 ${this.helvNum} 0 R /F2 ${this.helvBoldNum} 0 R >>${
        xobjEntries ? ` /XObject << ${xobjEntries} >>` : ""
      }`;

      const pageNum = this.writer.reserve();
      this.writer.writeObj(pageNum, {
        dict: `/Type /Page /Parent ${this.pagesNum} 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources << ${resources} >> /Contents ${contentNum} 0 R`,
      });
      pageObjNums.push(pageNum);
    }

    this.writer.writeObj(this.pagesNum, {
      dict: `/Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageObjNums.length}`,
    });
    this.writer.writeObj(this.catalogNum, { dict: `/Type /Catalog /Pages ${this.pagesNum} 0 R` });

    return this.writer.finish(this.catalogNum);
  }
}

// Approximate Helvetica glyph widths (per 1000 em, matching the real AFM
// metrics closely enough for this use). Digits are exactly right — real
// Helvetica digits are tabular at 556/1000 — which is what actually matters
// here: right-aligning the money/stat columns in the report table. Letter
// widths are categorized rather than a full 256-entry table; good enough
// for centering titles and truncating long ad names with an ellipsis,
// where being off by a point or two is invisible.
function charWidth(ch: string, bold: boolean): number {
  if (ch === " ") return 278;
  if (/[iIl.,;:'!|]/.test(ch)) return bold ? 278 : 222;
  if (/[0-9$]/.test(ch)) return 556;
  if (/[A-Z]/.test(ch)) return bold ? 722 : 667;
  if (/[mwMW]/.test(ch)) return bold ? 833 : 722;
  return bold ? 611 : 556;
}

export function textWidth(str: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of str) w += charWidth(ch, bold);
  return (w / 1000) * size;
}

// Truncates `str` with "…" so it fits within `maxWidth` at the given size —
// used for the ad-name column, which can otherwise run arbitrarily long.
export function truncateToWidth(
  str: string,
  size: number,
  bold: boolean,
  maxWidth: number,
): string {
  if (textWidth(str, size, bold) <= maxWidth) return str;
  const ellipsis = "…";
  let out = "";
  for (const ch of str) {
    if (textWidth(out + ch + ellipsis, size, bold) > maxWidth) break;
    out += ch;
  }
  return out + ellipsis;
}
