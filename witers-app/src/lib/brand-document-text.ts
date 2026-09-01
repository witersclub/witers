// Text that is stored alongside a Mente de marca file becomes durable context
// for Wit. Plain-text formats need no parsing; DOCX is a ZIP containing
// word/document.xml, which we can read in-browser without adding a heavy
// document dependency to the application bundle.

const TEXT_FILE = /\.(md|markdown|txt|text|json)$/i;
const DOCX_FILE = /\.docx$/i;
const MAX_CHARS = 12_000;

function decodeXmlText(xml: string): string {
  return xml
    .replace(/<w:tab\b[^>]*\/>/gi, "\t")
    .replace(/<w:br\b[^>]*\/>/gi, "\n")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  // The ZIP comment may be up to 65,535 bytes, so scan backwards from EOF.
  const start = Math.max(0, bytes.length - 65_557);
  for (let index = bytes.length - 22; index >= start; index -= 1) {
    if (bytes[index] === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === 0x05 && bytes[index + 3] === 0x06) return index;
  }
  return -1;
}

async function readDocxDocumentXml(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndOfCentralDirectory(bytes);
  if (end < 0) return null;

  const centralOffset = view.getUint32(end + 16, true);
  const centralSize = view.getUint32(end + 12, true);
  let cursor = centralOffset;
  const limit = centralOffset + centralSize;
  const decoder = new TextDecoder();

  while (cursor + 46 <= limit && view.getUint32(cursor, true) === 0x02014b50) {
    const compression = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + fileNameLength));

    if (name === "word/document.xml" && localOffset + 30 <= bytes.length && view.getUint32(localOffset, true) === 0x04034b50) {
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      if (compression === 0) return decoder.decode(compressed);
      if (compression === 8 && typeof DecompressionStream !== "undefined") {
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return decoder.decode(await new Response(stream).arrayBuffer());
      }
      return null;
    }
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  return null;
}

export type BrandTextExtraction = { text: string | null; readable: boolean };

export async function extractBrandDocumentText(file: File): Promise<BrandTextExtraction> {
  try {
    if (TEXT_FILE.test(file.name) || ["text/plain", "text/markdown", "application/json"].includes(file.type)) {
      return { text: (await file.text()).slice(0, MAX_CHARS).trim() || null, readable: true };
    }
    if (DOCX_FILE.test(file.name) || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const xml = await readDocxDocumentXml(file);
      return { text: xml ? decodeXmlText(xml).slice(0, MAX_CHARS) || null : null, readable: true };
    }
  } catch {
    // Keep the original file even if its text cannot be read. It remains a
    // visual/reference asset, and the UI explains that distinction.
  }
  return { text: null, readable: false };
}
