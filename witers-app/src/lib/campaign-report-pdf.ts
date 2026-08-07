// Builds the "Hacer reporte" PDFs — one for a single campaign's ads, one
// for all of a client's campaigns at once — with a WITERS-branded header,
// company/period metadata, and data tables. Runs entirely in the browser
// (needs fetch/canvas/Image to turn the logo PNG into an embeddable JPEG),
// on top of the dependency-free byte writer in simple-pdf.ts.
//
// Ad creative thumbnails are intentionally left out of every table — Meta's
// preview-image CDN doesn't reliably send permissive CORS headers, which
// would taint the canvas and block reading the pixels back out to embed
// them. A clean data table (name, status, spend, reach, impressions,
// results, cost/result) is what "professional report" actually needs, and
// it's dependable everywhere instead of silently breaking per-campaign.

import { SimplePdf, textWidth, truncateToWidth, type PdfPage, type RGB } from "./simple-pdf";

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

export type ReportCampaignSummary = {
  name: string | null;
  status: string;
  spend: string;
  impressions: string;
  reach: string;
  results: string;
  costPerResult: string;
};

export type ReportCampaignSection = {
  name: string | null;
  ads: ReportAd[];
};

type RowLike = {
  name: string | null;
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
// Bottom boundary content is allowed to reach before a page break — leaves
// room below for the footer (rule + "Generado por…" + page number).
const PAGE_BOTTOM = PAGE_H - 60;
const ROW_H = 20;

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

async function tryLoadLogo(pdf: SimplePdf): Promise<{ w: number; h: number } | null> {
  try {
    const loaded = await loadLogoJpeg();
    pdf.registerJpeg("logo", loaded.bytes, loaded.w, loaded.h);
    return { w: loaded.w, h: loaded.h };
  } catch {
    // Report still generates without the logo if it can't be loaded/encoded
    // — never worth failing the whole download over a header decoration.
    return null;
  }
}

function formatGeneratedAt(): string {
  return new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function rowValues(row: RowLike, maxNameWidth: number): string[] {
  return [
    truncateToWidth(row.name || "—", 9, false, maxNameWidth),
    STATUS_LABEL_ES[row.status] ?? row.status,
    money(Number(row.spend || 0)),
    count(Number(row.reach || 0)),
    count(Number(row.impressions || 0)),
    count(Number(row.results || 0)),
    money(Number(row.costPerResult || 0)),
  ];
}

function drawRowCells(
  page: PdfPage,
  y: number,
  values: string[],
  opts: { font: "F1" | "F2"; size: number; color: RGB; textYOffset: number },
) {
  let x = MARGIN;
  values.forEach((val, ci) => {
    const col = COLS[ci];
    if (val) {
      const tx =
        col.align === "right"
          ? x + col.w - 8 - textWidth(val, opts.size, opts.font === "F2")
          : x + 8;
      page.text(tx, y + opts.textYOffset, val, opts.font, opts.size, opts.color);
    }
    x += col.w;
  });
}

function drawTableHeader(page: PdfPage, yTop: number, firstColLabel = "Anuncio"): number {
  page.rect(MARGIN, yTop, CONTENT_W, 22, HEADER_ROW);
  let x = MARGIN;
  COLS.forEach((col, i) => {
    const label = i === 0 ? firstColLabel : col.label;
    const tx = col.align === "right" ? x + col.w - 8 - textWidth(label, 8.5, true) : x + 8;
    page.text(tx, yTop + 14.5, label, "F2", 8.5, WIT_BLUE);
    x += col.w;
  });
  return yTop + 22;
}

function drawTotalsRow(
  page: PdfPage,
  y: number,
  totals: { spend: number; impressions: number; results: number },
): number {
  page.rect(MARGIN, y, CONTENT_W, 22, [1, 1, 1]);
  page.line(MARGIN, y, PAGE_W - MARGIN, y, [0.8, 0.83, 0.9], 0.75);
  const costPerResult = totals.results > 0 ? totals.spend / totals.results : 0;
  drawRowCells(
    page,
    y,
    [
      "Total",
      "",
      money(totals.spend),
      "",
      count(totals.impressions),
      count(totals.results),
      totals.results > 0 ? money(costPerResult) : "—",
    ],
    { font: "F2", size: 9.5, color: INK, textYOffset: 15 },
  );
  return y + 22;
}

function drawFooter(page: PdfPage, pageNum: number, pageCount: number) {
  const y = PAGE_H - 28;
  page.line(MARGIN, y - 10, PAGE_W - MARGIN, y - 10, [0.88, 0.9, 0.94], 0.75);
  page.text(MARGIN, y, "Generado por WITERS · www.witers.com", "F1", 8, GRAY);
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
  const logo = await tryLoadLogo(pdf);

  const totals = input.ads.reduce(
    (acc, a) => {
      acc.spend += Number(a.spend || 0);
      acc.impressions += Number(a.impressions || 0);
      acc.results += Number(a.results || 0);
      return acc;
    },
    { spend: 0, impressions: 0, results: 0 },
  );

  const rowsPerPage = 26;
  const pageCount = Math.max(1, Math.ceil(input.ads.length / rowsPerPage) || 1);
  const generatedAt = formatGeneratedAt();

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
      if (i % 2 === 1) page.rect(MARGIN, y, CONTENT_W, ROW_H, LIGHT_ROW);
      drawRowCells(page, y, rowValues(ad, COLS[0].w - 16), {
        font: "F1",
        size: 9,
        color: INK,
        textYOffset: 14,
      });
      y += ROW_H;
    });

    if (pageIdx === pageCount - 1 && input.ads.length > 0) {
      drawTotalsRow(page, y, totals);
    } else if (input.ads.length === 0) {
      page.text(MARGIN, y + 16, "Esta campaña aún no tiene anuncios.", "F1", 10, GRAY);
    }

    drawFooter(page, pageIdx + 1, pageCount);
  }

  return pdf.build();
}

// The "Hacer reporte" button at the top of the Campañas tab — same idea as
// buildCampaignReportPdf but for every campaign at once: a summary table
// (one row per campaign) followed by a per-campaign ad-detail breakdown.
// Page count isn't known up front here (unlike the single-campaign report,
// where ads.length alone determines it) since it depends on how many
// campaigns and ads there are combined, so this builds pages on demand via
// ensureSpace() and only draws each footer at the very end, once the true
// total is known — a PdfPage's content stream can still be appended to
// right up until pdf.build() runs, regardless of when it was added.
export async function buildAllCampaignsReportPdf(input: {
  companyName: string | null;
  rangeLabel: string;
  campaigns: ReportCampaignSummary[];
  sections: ReportCampaignSection[];
}): Promise<Uint8Array> {
  const pdf = new SimplePdf(PAGE_W, PAGE_H);
  const logo = await tryLoadLogo(pdf);
  const generatedAt = formatGeneratedAt();

  const pages: PdfPage[] = [];
  // Definite-assignment: newPage() (called immediately below) always sets
  // this before anything else reads it — TS can't see that through the
  // closure.
  let page!: PdfPage;
  let y = MARGIN;

  function drawPageHeader() {
    y = MARGIN;
    if (logo) {
      const logoW = 78;
      const logoH = (logoW * logo.h) / logo.w;
      page.image("logo", MARGIN, y, logoW, logoH);
    }
    page.text(MARGIN + 96, y + 8, "Reporte de campañas", "F2", 18, INK);
    page.text(MARGIN + 96, y + 28, "Meta Ads · WITERS", "F1", 10, GRAY);
    y += 62;
    page.line(MARGIN, y, PAGE_W - MARGIN, y, WIT_BLUE, 1.5);
    y += 20;
  }

  function newPage() {
    page = pdf.addPage();
    pages.push(page);
    drawPageHeader();
  }

  function ensureSpace(needed: number, onNewPage?: () => void) {
    if (y + needed > PAGE_BOTTOM) {
      newPage();
      onNewPage?.();
    }
  }

  newPage();

  const metaRows: [string, string][] = [
    ["Empresa", input.companyName ?? "—"],
    ["Periodo", input.rangeLabel],
    ["Campañas", String(input.campaigns.length)],
    ["Generado", generatedAt],
  ];
  for (const [label, value] of metaRows) {
    page.text(MARGIN, y, `${label}:`, "F2", 9.5, GRAY);
    page.text(MARGIN + 75, y, truncateToWidth(value, 10, false, CONTENT_W - 75), "F1", 10, INK);
    y += 16;
  }
  y += 10;

  page.text(MARGIN, y + 10, "Resumen por campaña", "F2", 12, WIT_BLUE);
  y += 24;

  if (input.campaigns.length === 0) {
    page.text(MARGIN, y + 6, "No hubo campañas con actividad en este periodo.", "F1", 10, GRAY);
    y += 26;
  } else {
    ensureSpace(22);
    y = drawTableHeader(page, y, "Campaña");

    const totals = { spend: 0, impressions: 0, results: 0 };
    input.campaigns.forEach((c, i) => {
      ensureSpace(ROW_H, () => {
        y = drawTableHeader(page, y, "Campaña");
      });
      if (i % 2 === 1) page.rect(MARGIN, y, CONTENT_W, ROW_H, LIGHT_ROW);
      drawRowCells(page, y, rowValues(c, COLS[0].w - 16), {
        font: "F1",
        size: 9,
        color: INK,
        textYOffset: 14,
      });
      y += ROW_H;
      totals.spend += Number(c.spend || 0);
      totals.impressions += Number(c.impressions || 0);
      totals.results += Number(c.results || 0);
    });

    ensureSpace(22, () => {
      y = drawTableHeader(page, y, "Campaña");
    });
    y = drawTotalsRow(page, y, totals);
  }

  const sectionsWithAds = input.sections.filter((s) => s.ads.length > 0);
  if (sectionsWithAds.length > 0) {
    y += 14;
    ensureSpace(24);
    page.text(MARGIN, y + 10, "Detalle por campaña", "F2", 12, WIT_BLUE);
    y += 26;

    for (const section of sectionsWithAds) {
      ensureSpace(42);
      page.text(MARGIN, y + 9, section.name ?? "Campaña", "F2", 10.5, INK);
      y += 18;
      ensureSpace(22);
      y = drawTableHeader(page, y, "Anuncio");
      section.ads.forEach((ad, i) => {
        // If this row is what pushes onto a new page, repeat the campaign
        // name above the table header — otherwise the continuation page
        // opens on a bare ad table with no indication of whose ads they
        // are (the title was only drawn once, back on the previous page).
        ensureSpace(ROW_H, () => {
          page.text(MARGIN, y + 9, `${section.name ?? "Campaña"} (cont.)`, "F2", 10.5, INK);
          y += 18;
          y = drawTableHeader(page, y, "Anuncio");
        });
        if (i % 2 === 1) page.rect(MARGIN, y, CONTENT_W, ROW_H, LIGHT_ROW);
        drawRowCells(page, y, rowValues(ad, COLS[0].w - 16), {
          font: "F1",
          size: 9,
          color: INK,
          textYOffset: 14,
        });
        y += ROW_H;
      });
      y += 16;
    }
  }

  pages.forEach((p, i) => drawFooter(p, i + 1, pages.length));

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
