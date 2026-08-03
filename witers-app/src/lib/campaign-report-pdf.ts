// Builds the "Hacer reporte" PDF for a single campaign — WITERS-branded
// header, company/campaign/period metadata, and a table of the ads
// ("piezas pautadas") with their stats. Runs entirely in the browser (needs
// fetch/canvas/Image to turn the logo PNG into an embeddable JPEG), on top
// of the dependency-free byte writer in simple-pdf.ts.
//
// Ad creative thumbnails are intentionally left out of the table — Meta's
// preview-image CDN doesn't reliably send permissive CORS headers, which
// would taint the canvas and block reading the pixels back out to embed
// them. A clean data table (name, status, spend, reach, impressions,
// results, cost/result) is what "professional report" actually needs, and
// it's dependable everywhere instead of silently breaking per-campaign.

import { SimplePdf, textWidth, truncateToWidth, type RGB } from "./simple-pdf";

export type ReportAd = {
  id: string;
  name: string;
  status: string;
  spend: string;
  impressions: string;
  reach: string;
  results: string;
  costPerResult: string;
};

const STATUS_LABEL_ES: Record<string, string> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  DELETED: "Eliminada",
  ARCHIVED: "Archivada",
};

const WIT_BLUE: RGB = [0, 0.2784, 1];
const INK: RGB = [0.06, 0.08, 0.16];
const GRAY: RGB = [0.44, 0.47, 0.55];
const LIGHT_ROW: RGB = [0.965, 0.97, 0.985];
const HEADER_ROW: RGB = [0.92, 0.945, 1];

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLS: { label: string; w: number; align: "left" | "right" }[] = [
  { label: "Anuncio", w: 150, align: "left" },
  { label: "Estado", w: 55, align: "left" },
  { label: "Gasto", w: 60, align: "right" },
  { label: "Alcance", w: 62, align: "right" },
  { label: "Impr.", w: 62, align: "right" },
  { label: "Result.", w: 60, align: "right" },
  { label: "Costo/res.", w: 63, align: "right" },
];

function money(n: number): string {
  return `$${n.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`;
}

function count(n: number): string {
  return n.toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

// Loads a same-origin PNG, composites it over white (JPEG has no alpha
// channel) and re-encodes as JPEG — same-origin means no CORS taint, so
// canvas pixel readback is safe here even though it isn't for ad images.
async function loadLogoJpeg(): Promise<{ bytes: Uint8Array; w: number; h: number }> {
  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("logo_load_failed"));
  });
  img.src = "/assets/logo_full.png";
  await loaded;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("jpeg_encode_failed");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, w: canvas.width, h: canvas.height };
}

function drawTableHeader(page: import("./simple-pdf").PdfPage, yTop: number): number {
  page.rect(MARGIN, yTop, CONTENT_W, 22, HEADER_ROW);
  let x = MARGIN;
  for (const col of COLS) {
    const tx = col.align === "right" ? x + col.w - 8 - textWidth(col.label, 8.5, true) : x + 8;
    page.text(tx, yTop + 14.5, col.label, "F2", 8.5, WIT_BLUE);
    x += col.w;
  }
  return yTop + 22;
}

function drawFooter(page: import("./simple-pdf").PdfPage, pageNum: number, pageCount: number) {
  const y = PAGE_H - 28;
  page.line(MARGIN, y - 10, PAGE_W - MARGIN, y - 10, [0.88, 0.9, 0.94], 0.75);
  page.text(MARGIN, y, "Generado por WITERS · witers.club", "F1", 8, GRAY);
  const pageLabel = `Página ${pageNum} de ${pageCount}`;
  page.text(PAGE_W - MARGIN - textWidth(pageLabel, 8, false), y, pageLabel, "F1", 8, GRAY);
}

export async function buildCampaignReportPdf(input: {
  companyName: string | null;
  campaignName: string;
  rangeLabel: string;
  ads: ReportAd[];
}): Promise<Uint8Array> {
  const pdf = new SimplePdf(PAGE_W, PAGE_H);

  let logo: { w: number; h: number } | null = null;
  try {
    const loaded = await loadLogoJpeg();
    pdf.registerJpeg("logo", loaded.bytes, loaded.w, loaded.h);
    logo = { w: loaded.w, h: loaded.h };
  } catch {
    // Report still generates without the logo if it can't be loaded/encoded —
    // never worth failing the whole download over a header decoration.
    logo = null;
  }

  const totalSpend = input.ads.reduce((s, a) => s + Number(a.spend || 0), 0);
  const totalImpressions = input.ads.reduce((s, a) => s + Number(a.impressions || 0), 0);
  const totalResults = input.ads.reduce((s, a) => s + Number(a.results || 0), 0);
  const totalCostPerResult = totalResults > 0 ? totalSpend / totalResults : 0;

  const rowsPerPage = 26;
  const pageCount = Math.max(1, Math.ceil(input.ads.length / rowsPerPage) || 1);
  const generatedAt = new Date().toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
    const page = pdf.addPage();
    let y = MARGIN;

    if (logo) {
      const logoW = 78;
      const logoH = (logoW * logo.h) / logo.w;
      page.image("logo", MARGIN, y, logoW, logoH);
    }
    page.text(MARGIN + 96, y + 8, "Reporte de campaña", "F2", 18, INK);
    page.text(MARGIN + 96, y + 28, "Meta Ads · WITERS", "F1", 10, GRAY);
    y += 62;
    page.line(MARGIN, y, PAGE_W - MARGIN, y, WIT_BLUE, 1.5);
    y += 20;

    if (pageIdx === 0) {
      const metaRows: [string, string][] = [
        ["Empresa", input.companyName ?? "—"],
        ["Campaña", input.campaignName || "—"],
        ["Periodo", input.rangeLabel],
        ["Generado", generatedAt],
      ];
      for (const [label, value] of metaRows) {
        page.text(MARGIN, y, `${label}:`, "F2", 9.5, GRAY);
        page.text(MARGIN + 65, y, truncateToWidth(value, 10, false, CONTENT_W - 65), "F1", 10, INK);
        y += 16;
      }
      y += 8;
    }

    y = drawTableHeader(page, y);

    const startIdx = pageIdx * rowsPerPage;
    const pageAds = input.ads.slice(startIdx, startIdx + rowsPerPage);
    pageAds.forEach((ad, i) => {
      const rowH = 20;
      if (i % 2 === 1) page.rect(MARGIN, y, CONTENT_W, rowH, LIGHT_ROW);
      const statusLabel = STATUS_LABEL_ES[ad.status] ?? ad.status;
      const values = [
        truncateToWidth(ad.name || "—", 9, false, COLS[0].w - 16),
        statusLabel,
        money(Number(ad.spend || 0)),
        count(Number(ad.reach || 0)),
        count(Number(ad.impressions || 0)),
        count(Number(ad.results || 0)),
        money(Number(ad.costPerResult || 0)),
      ];
      let x = MARGIN;
      values.forEach((val, ci) => {
        const col = COLS[ci];
        const tx = col.align === "right" ? x + col.w - 8 - textWidth(val, 9, false) : x + 8;
        page.text(tx, y + 14, val, "F1", 9, INK);
        x += col.w;
      });
      y += rowH;
    });

    if (pageIdx === pageCount - 1 && input.ads.length > 0) {
      page.rect(MARGIN, y, CONTENT_W, 22, [1, 1, 1]);
      page.line(MARGIN, y, PAGE_W - MARGIN, y, [0.8, 0.83, 0.9], 0.75);
      const totals = [
        "Total",
        "",
        money(totalSpend),
        "",
        count(totalImpressions),
        count(totalResults),
        totalResults > 0 ? money(totalCostPerResult) : "—",
      ];
      let x = MARGIN;
      totals.forEach((val, ci) => {
        const col = COLS[ci];
        if (val) {
          const tx = col.align === "right" ? x + col.w - 8 - textWidth(val, 9.5, true) : x + 8;
          page.text(tx, y + 15, val, "F2", 9.5, INK);
        }
        x += col.w;
      });
    } else if (input.ads.length === 0) {
      page.text(MARGIN, y + 16, "Esta campaña aún no tiene anuncios.", "F1", 10, GRAY);
    }

    drawFooter(page, pageIdx + 1, pageCount);
  }

  return pdf.build();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  // Cast needed because TS's DOM lib types BlobPart as requiring an
  // ArrayBuffer-backed view specifically, while Uint8Array's generic buffer
  // type is ArrayBufferLike — a Uint8Array is a valid BlobPart at runtime
  // regardless.
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
