import { SimplePdf, truncateToWidth, type RGB } from "./simple-pdf";

type CalendarPdfEntry = { date: string; slot?: number; format: string; title: string; brief: string };

const BLUE: RGB = [0, 0.278, 1];
const INK: RGB = [0.06, 0.08, 0.16];
const GRAY: RGB = [0.42, 0.46, 0.56];
const W = 612;
const H = 792;
const M = 48;

export function buildCalendarPlanPdf(input: {
  companyName?: string | null;
  monthLabel: string;
  entries: CalendarPdfEntry[];
}): Uint8Array {
  const pdf = new SimplePdf(W, H);
  const ordered = [...input.entries].sort((a, b) =>
    `${a.date}-${a.slot ?? 1}`.localeCompare(`${b.date}-${b.slot ?? 1}`),
  );
  const perPage = 19;
  const pageCount = Math.max(1, Math.ceil(ordered.length / perPage));
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const page = pdf.addPage();
    let y = M;
    page.text(M, y, "WITERS", "F2", 18, BLUE);
    page.text(M, y + 24, "Planificación de contenido", "F2", 20, INK);
    page.text(M, y + 42, input.companyName || "Tu marca", "F1", 10, GRAY);
    page.text(M, y + 58, input.monthLabel, "F1", 10, GRAY);
    page.line(M, y + 74, W - M, y + 74, BLUE, 1.25);
    y += 95;
    ordered.slice(pageIndex * perPage, (pageIndex + 1) * perPage).forEach((entry, index) => {
      if (index % 2 === 0) page.rect(M, y - 13, W - M * 2, 31, [0.97, 0.98, 1]);
      const date = new Date(`${entry.date}T12:00:00Z`).toLocaleDateString("es-MX", {
        day: "numeric", month: "short", timeZone: "UTC",
      });
      const left = `${date}${entry.slot === 2 ? " · 2ª publicación" : ""}`;
      page.text(M + 8, y, left, "F2", 9, BLUE);
      page.text(M + 108, y, truncateToWidth(entry.title, 10, true, 330), "F2", 10, INK);
      page.text(M + 8, y + 15, `${entry.format} · ${truncateToWidth(entry.brief, 8.5, false, 470)}`, "F1", 8.5, GRAY);
      y += 35;
    });
    page.line(M, H - 42, W - M, H - 42, [0.88, 0.9, 0.94], 0.75);
    page.text(M, H - 28, "Generado por WITERS · www.witers.com", "F1", 8, GRAY);
    page.text(W - M - 48, H - 28, `Página ${pageIndex + 1}/${pageCount}`, "F1", 8, GRAY);
  }
  return pdf.build();
}
