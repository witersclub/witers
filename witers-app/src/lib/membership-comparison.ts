// Feature-by-feature view of the same 3 tiers in membership-plans.ts,
// reshaped from "list of bullets per plan" into "one row per feature,
// value per plan" for the comparison table under the homepage's fichas.
// Two judgment calls made here, not a literal 1:1 of
// MEMBERSHIP_PLANS[].beneficios:
//  - "Entregas en alta resolución" is only spelled out in Essential's
//    bullet list, but every tier delivers at that quality — the pricier
//    tiers just didn't repeat the line. Checked for all 3 here so the
//    table doesn't read as Grow/Scale delivering lower-quality files.
//  - Essential's "Acompañamiento estratégico para tu marca" and Grow/
//    Scale's "Asesoría estratégica personalizada" are the same feature
//    at two levels (basic vs. personalized), not two unrelated perks —
//    merged into one row instead of two check/dash rows that would make
//    Essential look like it has something Grow doesn't.
import type { PlanId } from "./membership-plans";

export type ComparisonValue = string | true | null;

export type ComparisonRow = {
  label: string;
  values: Record<PlanId, ComparisonValue>;
};

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: "Solicitudes de diseño al mes",
    values: { essential: "10", grow: "15", scale: "20" },
  },
  {
    label: "Revisiones por diseño",
    values: { essential: "Hasta 2", grow: "Hasta 2", scale: "Hasta 3" },
  },
  {
    label: "Campañas publicitarias",
    values: { essential: "2", grow: "3", scale: "4" },
  },
  {
    label: "Carruseles para redes sociales",
    values: { essential: null, grow: "2", scale: "4" },
  },
  {
    label: "Videos para redes sociales",
    values: { essential: null, grow: "2", scale: "4" },
  },
  {
    label: "Acompañamiento / asesoría estratégica",
    values: { essential: "Básico", grow: "Personalizada", scale: "Personalizada" },
  },
  {
    label: "Planeación estratégica de contenido",
    values: { essential: null, grow: true, scale: true },
  },
  {
    label: "Reporte semanal de desempeño",
    values: { essential: null, grow: true, scale: true },
  },
  {
    label: "Auditoría mensual de estrategia y resultados",
    values: { essential: null, grow: null, scale: true },
  },
  {
    label: "Reunión mensual de seguimiento estratégico",
    values: { essential: null, grow: null, scale: true },
  },
  {
    label: "Prioridad alta en tiempos de entrega",
    values: { essential: null, grow: null, scale: true },
  },
  {
    label: "Entregas en alta resolución, listas para publicar",
    values: { essential: true, grow: true, scale: true },
  },
  {
    label: "Panel exclusivo para dar seguimiento a cada solicitud",
    values: { essential: true, grow: true, scale: true },
  },
];
