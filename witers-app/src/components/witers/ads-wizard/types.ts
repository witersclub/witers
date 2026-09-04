// Shared types for the "Pautar" micro-step wizard (CampaignCreationSheet
// + everything under this directory). Kept in one place so every step
// file agrees on the same shapes without importing from the container.

export type CampaignPiece = {
  requestId: string;
  title: string;
  caption: string | null;
  previewUrl: string | null;
  format: "imagen" | "video" | "carrusel";
};

export type AccountStatus = {
  connected: boolean;
  accountId: string | null;
  accountName: string | null;
};

export type SocialConnections = {
  facebook: { name: string | null } | null;
  instagram: { name: string | null } | null;
};

export type AccountOption = { account_id: string; name: string; currency: string };

export type WhatsAppNumber = {
  phoneNumberId: string;
  displayNumber: string;
  verifiedName: string | null;
  status: string | null;
};

// The real objective values the backend understands (see
// meta-ads-create.server.ts's resolveObjective). "interaccion" has no
// distinct real implementation today — it resolves identically to
// "ventas" (both are the messaging/OUTCOME_ENGAGEMENT path). The new
// Paso 1 UI borrows it to represent "Llegar a más personas" only as a
// visual placeholder (marked "Próximamente", not selectable) — see
// AdsObjectiveStep for why it's never actually submitted.
export type Objective = "ventas" | "trafico" | "interaccion";

export type TrafficDestination = "website" | "facebook_page" | "instagram_profile";
export type MessagingChannel = "whatsapp" | "messenger" | "instagram_direct";

export type SavedAudience = {
  id: string;
  name: string;
  description: string;
  ageMin: number;
  ageMax: number;
  locationKey: string | null;
  locationLabel: string | null;
  radiusKm: number | null;
  interests: { id: string; name: string }[];
  notes: string | null;
};

export type AudienceMode = "wit" | "manual" | "saved" | null;

// From /api/meta-interest-search — real Meta interest search
// (searchMetaInterests in meta-ads-create.server.ts), previously wired
// to no UI. Never invented locally.
export type InterestSuggestion = { id: string; name: string; audienceSize: number | null };

// From /api/meta-location-search — real Meta city/zip/place search
// (searchMetaLocations), same "existing but unwired" status.
export type LocationSuggestion = { key: string; name: string; type: string; region: string | null };

export type BrandLite = { companyName: string | null; logoUrl: string | null };

// The wizard's own step sequence — Paso 8 (creación) is a transient
// progress/result screen, not something the user can navigate back into
// from the header's "Paso X de 7" (7 real decision steps, 0 excluded
// since it can auto-skip).
export type WizardStepId =
  | "preparacion"
  | "objetivo"
  | "destino"
  | "presupuesto"
  | "duracion"
  | "audiencia"
  | "creativo"
  | "revision"
  | "creando";

export const WIZARD_STEP_ORDER: WizardStepId[] = [
  "preparacion",
  "objetivo",
  "destino",
  "presupuesto",
  "duracion",
  "audiencia",
  "creativo",
  "revision",
  "creando",
];
