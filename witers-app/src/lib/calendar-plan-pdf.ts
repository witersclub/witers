// CAMBIO 04D — full rewrite. The old version was one compressed table
// (date/title/brief truncated to one line) across as many pages as needed.
// This builds the 11-section "agency deliverable" structure requested:
// cover, executive summary, objectives, audience, content pillars, format
// mix, funnel map, executive calendar, per-piece detail, production
// recommendations, strategic observations.
//
// Everything here is DERIVED from the plan's own data (the entries plus
// their PILAR/ETAPA/AUDIENCIA/MÉTRICA header line — see
// buildCalendarSystemPrompt in wit-chat.server.ts) and simple templated
// heuristics — there is no separate AI call to write prose for this PDF.
// That's a deliberate scope line: the strategic summary/recommendations/
// observations read as generated analysis of the real plan, not narrative
// AI copy, and adding the latter would mean a new AI call + a place to
// persist its output, which is a bigger, separate change to flag rather
// than build silently.
import { SimplePdf, truncateToWidth, wrapText, type RGB } from "./simple-pdf";

export type CalendarPdfSlide = { title?: string | null; brief: string };
export type CalendarPdfEntry = {
  date: string;
  slot?: number;
  format: "imagen" | "video" | "carrusel";
  title: string;
  brief: string;
  slides?: CalendarPdfSlide[];
};

const BLUE: RGB = [0, 0.278, 1];
const INK: RGB = [0.06, 0.08, 0.16];
const GRAY: RGB = [0.42, 0.46, 0.56];
const LIGHT: RGB = [0.97, 0.98, 1];
const LINE: RGB = [0.88, 0.9, 0.94];
const PILLAR_COLORS: RGB[] = [
  [0, 0.278, 1],
  [0.06, 0.08, 0.16],
  [0.42, 0.46, 0.56],
  [0, 0.55, 0.45],
  [0.62, 0.32, 0.02],
];

const W = 612;
const H = 792;
const M = 48;
const CONTENT_W = W - M * 2;
const FOOTER_Y = H - 30;

const FORMAT_LABEL: Record<CalendarPdfEntry["format"], string> = {
  imagen: "Imagen",
  video: "Video/Reel",
  carrusel: "Carrusel",
};

type BriefMeta = {
  pilar: string | null;
  etapa: string | null;
  audiencia: string | null;
  metrica: string | null;
};

// Reads the 'PILAR: ... | ETAPA: ... | AUDIENCIA: ...' (+ 'MÉTRICA: ...')
// header line every new brief carries (see buildCalendarSystemPrompt).
// Entries planned before that change simply have no tags — every section
// below treats a missing tag as "sin clasificar" rather than failing.
function parseBriefMeta(brief: string): BriefMeta {
  // Keep the real newline between the first two lines — AUDIENCIA and
  // MÉTRICA can land on separate lines, and a joined-with-space head would
  // erase that boundary. Each field also stops at the next known label
  // (not just "|" or a newline) since the model can write "AUDIENCIA: x
  // MÉTRICA: y" on one line without a pipe between them.
  const head = brief.split("\n").slice(0, 2).join("\n");
  const boundary = "(?=\\s*(?:\\||PILAR:|ETAPA:|AUDIENCIA:|M[ÉE]TRICA:|$))";
  const grab = (label: string) =>
    new RegExp(`${label}:\\s*([^|\\n]+?)${boundary}`, "i").exec(head)?.[1]?.trim() || null;
  return {
    pilar: grab("PILAR"),
    etapa: grab("ETAPA"),
    audiencia: grab("AUDIENCIA"),
    metrica: grab("M[ÉE]TRICA"),
  };
}

// The body of the brief, without that header line — shown separately in
// "Detalle de piezas" as labeled fields, so the raw header line doesn't
// also print twice as plain prose.
function stripBriefMeta(brief: string): string {
  const lines = brief.split("\n");
  let cut = 0;
  while (
    cut < lines.length &&
    cut < 3 &&
    /^(PILAR|ETAPA|AUDIENCIA|M[ÉE]TRICA)\s*:/i.test(lines[cut].trim())
  ) {
    cut++;
  }
  const rest = lines.slice(cut).join("\n").trim();
  return rest || brief;
}

type Layout = {
  pdf: SimplePdf;
  page: ReturnType<SimplePdf["addPage"]>;
  y: number;
  pageNum: number;
};

function newPage(state: Layout) {
  state.page = state.pdf.addPage();
  state.pageNum += 1;
  state.page.text(M, FOOTER_Y, "Generado por WITERS · www.witers.com", "F1", 8, GRAY);
  state.page.text(W - M - 60, FOOTER_Y, `Página ${state.pageNum}`, "F1", 8, GRAY);
  state.y = M;
}

function ensureSpace(state: Layout, needed: number) {
  if (state.y + needed > FOOTER_Y - 14) newPage(state);
}

function sectionTitle(state: Layout, title: string) {
  ensureSpace(state, 40);
  state.y += 8;
  state.page.text(M, state.y, title.toUpperCase(), "F2", 12, BLUE);
  state.y += 8;
  state.page.line(M, state.y, W - M, state.y, LINE, 1);
  state.y += 18;
}

function paragraph(
  state: Layout,
  text: string,
  opts?: { size?: number; color?: RGB; bold?: boolean },
) {
  const size = opts?.size ?? 9.5;
  const color = opts?.color ?? INK;
  const lines = wrapText(text, size, Boolean(opts?.bold), CONTENT_W);
  for (const line of lines) {
    ensureSpace(state, size + 5);
    state.page.text(M, state.y, line, opts?.bold ? "F2" : "F1", size, color);
    state.y += size + 5;
  }
}

function bullet(state: Layout, text: string) {
  const size = 9.5;
  const indent = 14;
  const lines = wrapText(text, size, false, CONTENT_W - indent);
  lines.forEach((line, i) => {
    ensureSpace(state, size + 5);
    if (i === 0) state.page.text(M, state.y, "•", "F2", size, BLUE);
    state.page.text(M + indent, state.y, line, "F1", size, INK);
    state.y += size + 5;
  });
}

// A labeled horizontal bar — used for pilares/funnel/mix de formatos so
// those sections read as a quick visual breakdown, not another table.
function barRow(state: Layout, label: string, count: number, maxCount: number, color: RGB) {
  ensureSpace(state, 22);
  state.page.text(M, state.y, truncateToWidth(label, 9, true, 190), "F2", 9, INK);
  const barX = M + 200;
  const barMaxW = CONTENT_W - 200 - 34;
  const barW = maxCount > 0 ? Math.max(4, (count / maxCount) * barMaxW) : 0;
  state.page.rect(barX, state.y - 8, barMaxW, 10, LIGHT);
  state.page.rect(barX, state.y - 8, barW, 10, color);
  state.page.text(barX + barMaxW + 8, state.y, String(count), "F2", 9, GRAY);
  state.y += 20;
}

function tally<T extends string>(values: (T | null)[], fallback: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value || fallback;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

export function buildCalendarPlanPdf(input: {
  companyName?: string | null;
  monthLabel: string;
  entries: CalendarPdfEntry[];
}): Uint8Array {
  const pdf = new SimplePdf(W, H);
  const companyName = input.companyName?.trim() || "Tu marca";
  const ordered = [...input.entries].sort((a, b) =>
    `${a.date}-${a.slot ?? 1}`.localeCompare(`${b.date}-${b.slot ?? 1}`),
  );
  const metaByEntry = new Map(ordered.map((entry) => [entry, parseBriefMeta(entry.brief)]));
  const total = ordered.length;

  // ---------- 1. PORTADA ----------
  const cover = pdf.addPage();
  cover.text(M, 210, "WITERS", "F2", 22, BLUE);
  cover.line(M, 224, W - M, 224, LINE, 1);
  cover.text(M, 340, "Planificación de", "F1", 26, GRAY);
  cover.text(M, 372, "contenido", "F2", 34, INK);
  cover.text(M, 420, companyName, "F2", 15, BLUE);
  cover.text(M, 442, input.monthLabel, "F1", 12, GRAY);
  cover.text(
    M,
    H - 70,
    `Generado el ${new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}`,
    "F1",
    9,
    GRAY,
  );
  cover.text(M, H - 54, "Documento preparado por WITERS · www.witers.com", "F1", 9, GRAY);

  const state: Layout = { pdf, page: cover, y: 0, pageNum: 1 };
  newPage(state);

  if (!total) {
    sectionTitle(state, "Este mes aún no tiene piezas planeadas");
    paragraph(state, "Vuelve a generar el PDF una vez que la planificación tenga contenido.");
    return pdf.build();
  }

  // ---------- data used across several sections ----------
  const formatCounts = tally(
    ordered.map((e) => FORMAT_LABEL[e.format]),
    "Sin formato",
  );
  const pillarCounts = tally(
    ordered.map((e) => metaByEntry.get(e)!.pilar),
    "Sin pilar asignado",
  );
  const funnelCounts = tally(
    ordered.map((e) => metaByEntry.get(e)!.etapa),
    "Sin etapa asignada",
  );
  const audiences = [
    ...new Set(
      ordered.map((e) => metaByEntry.get(e)!.audiencia).filter((a): a is string => Boolean(a)),
    ),
  ];
  const untaggedCount = ordered.filter((e) => !metaByEntry.get(e)!.pilar).length;

  // ---------- 2. RESUMEN ESTRATÉGICO ----------
  sectionTitle(state, "Resumen estratégico");
  const topPillar = [...pillarCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topFunnel = [...funnelCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  paragraph(
    state,
    `${input.monthLabel} incluye ${total} ${total === 1 ? "pieza" : "piezas"} distribuidas en ` +
      `${formatCounts.size} formato${formatCounts.size === 1 ? "" : "s"}` +
      (topPillar ? `, con mayor peso en "${topPillar[0]}"` : "") +
      (topFunnel ? ` y enfoque principal en la etapa de "${topFunnel[0]}".` : "."),
  );
  paragraph(
    state,
    audiences.length
      ? `El plan atiende ${audiences.length} perfil${audiences.length === 1 ? "" : "es"} de audiencia distinto${audiences.length === 1 ? "" : "s"} (ver sección Audiencia).`
      : "Las piezas de este mes no traen una audiencia etiquetada explícitamente — se detalla por pieza en el desarrollo de cada una.",
  );

  // ---------- 3. OBJETIVOS ----------
  sectionTitle(state, "Objetivos del mes");
  paragraph(
    state,
    "Distribución real de las piezas por etapa de funnel — el objetivo que cada pieza persigue " +
      "dentro de la estrategia general del mes:",
    { color: GRAY },
  );
  state.y += 4;
  const funnelMax = Math.max(...funnelCounts.values());
  [...funnelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([label, count], i) =>
      barRow(state, label, count, funnelMax, PILLAR_COLORS[i % PILLAR_COLORS.length]),
    );

  // ---------- 4. AUDIENCIA ----------
  sectionTitle(state, "Audiencia");
  if (audiences.length) {
    paragraph(state, "Perfiles de audiencia a los que le habla el contenido de este mes:", {
      color: GRAY,
    });
    state.y += 2;
    audiences.forEach((a) => bullet(state, a));
  } else {
    paragraph(state, "Ninguna pieza de este mes trae una audiencia específica etiquetada todavía.");
  }

  // ---------- 5. PILARES DE CONTENIDO ----------
  sectionTitle(state, "Pilares de contenido");
  const pillarMax = Math.max(...pillarCounts.values());
  [...pillarCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([label, count], i) =>
      barRow(state, label, count, pillarMax, PILLAR_COLORS[i % PILLAR_COLORS.length]),
    );

  // ---------- 6. MIX DE FORMATOS ----------
  sectionTitle(state, "Mix de formatos");
  const formatMax = Math.max(...formatCounts.values());
  [...formatCounts.entries()].forEach(([label, count], i) =>
    barRow(state, label, count, formatMax, PILLAR_COLORS[i % PILLAR_COLORS.length]),
  );

  // ---------- 7. MAPA DEL FUNNEL ---------- (same tags as Objetivos, framed
  // as a funnel so the deliverable reads as strategy, not a repeated chart)
  sectionTitle(state, "Mapa del funnel");
  paragraph(
    state,
    "Awareness y educación construyen alcance; consideración y confianza mueven al prospecto; " +
      "conversión y retención cierran y fidelizan. Cómo se reparte este mes:",
    { color: GRAY },
  );
  state.y += 4;
  [...funnelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([label, count]) => {
      ensureSpace(state, 16);
      const pct = Math.round((count / total) * 100);
      paragraph(state, `${label}: ${count} pieza${count === 1 ? "" : "s"} (${pct}%)`, {
        size: 9.5,
      });
    });

  // ---------- 8. CALENDARIO EJECUTIVO ----------
  sectionTitle(state, "Calendario ejecutivo");
  ordered.forEach((entry) => {
    ensureSpace(state, 16);
    const date = new Date(`${entry.date}T12:00:00Z`).toLocaleDateString("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    const meta = metaByEntry.get(entry)!;
    state.page.text(M, state.y, date, "F2", 8.5, BLUE);
    state.page.text(
      M + 90,
      state.y,
      `${FORMAT_LABEL[entry.format]} · ${truncateToWidth(entry.title, 8.5, false, 340)}${meta.etapa ? ` (${meta.etapa})` : ""}`,
      "F1",
      8.5,
      INK,
    );
    state.y += 15;
  });

  // ---------- 9. DETALLE DE PIEZAS ----------
  sectionTitle(state, "Detalle de piezas");
  ordered.forEach((entry, index) => {
    const meta = metaByEntry.get(entry)!;
    ensureSpace(state, 50);
    if (index > 0) {
      state.y += 4;
      state.page.line(M, state.y, W - M, state.y, LINE, 0.75);
      state.y += 14;
    }
    const date = new Date(`${entry.date}T12:00:00Z`).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    paragraph(
      state,
      `${date}${entry.slot === 2 ? " · 2ª publicación" : ""} · ${FORMAT_LABEL[entry.format]}`,
      {
        size: 8,
        color: BLUE,
        bold: true,
      },
    );
    paragraph(state, entry.title, { size: 11, bold: true });
    const tags = [
      meta.pilar ? `Pilar: ${meta.pilar}` : null,
      meta.etapa ? `Etapa: ${meta.etapa}` : null,
      meta.audiencia ? `Audiencia: ${meta.audiencia}` : null,
      meta.metrica ? `Métrica: ${meta.metrica}` : null,
    ].filter((t): t is string => Boolean(t));
    if (tags.length) paragraph(state, tags.join("   ·   "), { size: 8, color: GRAY });
    state.y += 2;
    if (entry.format === "carrusel" && entry.slides?.length) {
      entry.slides.forEach((slide, i) => {
        paragraph(
          state,
          `Lámina ${i + 1}${slide.title ? ` — ${slide.title}` : ""}: ${slide.brief}`,
          {
            size: 8.5,
            color: GRAY,
          },
        );
      });
    } else {
      paragraph(state, stripBriefMeta(entry.brief), { size: 8.5, color: GRAY });
    }
  });

  // ---------- 10. RECOMENDACIONES DE PRODUCCIÓN ----------
  sectionTitle(state, "Recomendaciones de producción");
  const recommendations: string[] = [];
  if (formatCounts.has(FORMAT_LABEL.video))
    recommendations.push(
      "Video/Reels: sube el metraje propio con tiempo — el equipo edita sobre lo que subas, así que entre antes mejor calidad de guion final.",
    );
  if (formatCounts.has(FORMAT_LABEL.carrusel))
    recommendations.push(
      "Carruseles: mantén una plantilla visual consistente entre láminas (misma tipografía y retícula) para que se lean como una sola pieza al deslizar.",
    );
  if (formatCounts.has(FORMAT_LABEL.imagen))
    recommendations.push(
      "Imágenes: revisa que el copy en pieza sea legible en miniatura — es como la mayoría de la audiencia la ve primero, en el feed.",
    );
  recommendations.push(
    "Publica cada pieza con el copy sugerido del panel — ya está adaptado al tono de marca y listo para pegar.",
  );
  recommendations.forEach((r) => bullet(state, r));

  // ---------- 11. OBSERVACIONES ESTRATÉGICAS ----------
  sectionTitle(state, "Observaciones estratégicas");
  const observations: string[] = [];
  if (untaggedCount > 0)
    observations.push(
      `${untaggedCount} de ${total} piezas se planearon antes de esta actualización y no traen pilar/etapa etiquetados — se pueden regenerar para incluir el detalle completo.`,
    );
  const dominantFunnel = [...funnelCounts.entries()].find(([, count]) => count / total > 0.6);
  if (dominantFunnel)
    observations.push(
      `"${dominantFunnel[0]}" concentra más del 60% de las piezas del mes — vale la pena diversificar hacia otras etapas del funnel el próximo mes.`,
    );
  if (pillarCounts.size === 1 && total > 3)
    observations.push(
      "Todo el mes gira sobre un solo pilar de contenido — considera sumar variedad temática para no volverse predecible.",
    );
  if (!observations.length)
    observations.push(
      "La distribución de este mes está balanceada entre pilares y etapas del funnel.",
    );
  observations.forEach((o) => bullet(state, o));

  return pdf.build();
}
