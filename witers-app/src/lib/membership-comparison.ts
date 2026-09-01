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
    values: { mensual: "30", plus: "60" },
  },
  {
    label: "Publicaciones por día",
    values: { mensual: "1", plus: "Hasta 2" },
  },
  {
    label: "Imágenes",
    values: { mensual: "20", plus: "40" },
  },
  {
    label: "Carruseles para redes sociales",
    values: { mensual: "5", plus: "10" },
  },
  {
    label: "Videos para redes sociales",
    values: { mensual: "5", plus: "10" },
  },
  {
    label: "Planeación estratégica de contenido",
    values: { mensual: true, plus: true },
  },
  {
    label: "Entregas en alta resolución, listas para publicar",
    values: { mensual: true, plus: true },
  },
  {
    label: "Panel exclusivo para dar seguimiento a cada solicitud",
    values: { mensual: true, plus: true },
  },
];
