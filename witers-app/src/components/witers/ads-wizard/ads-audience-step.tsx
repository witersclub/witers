import { useEffect, useRef, useState } from "react";
import { Bookmark, Loader2, MapPin, Sparkles, Target, X } from "lucide-react";

import { useLanguage } from "../../../lib/i18n";
import type { AudienceMode, InterestSuggestion, LocationSuggestion, SavedAudience } from "./types";

// Debounced live search against Meta's own real location/interest search
// — /api/meta-location-search and /api/meta-interest-search already
// existed in this codebase (searchMetaLocations/searchMetaInterests in
// meta-ads-create.server.ts) but had no UI calling them until this step.
// Never returns invented ids: every result comes straight from Meta.
function useMetaSearch<T>(
  path: string,
  extraParams: Record<string, string> = {},
): {
  query: string;
  setQuery: (q: string) => void;
  results: T[];
  loading: boolean;
  clear: () => void;
} {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);
  const extraParamsKey = JSON.stringify(extraParams);

  useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = window.setTimeout(() => {
      const params = new URLSearchParams({ q: trimmed, ...JSON.parse(extraParamsKey) });
      fetch(`${path}?${params.toString()}`, { credentials: "include" })
        .then((res) => res.json())
        .then((data: { ok?: boolean; results?: T[] }) =>
          setResults(data.ok ? (data.results ?? []) : []),
        )
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 350);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [query, path, extraParamsKey]);

  return { query, setQuery, results, loading, clear: () => setQuery("") };
}

type Interest = { id: string; name: string };

export function AdsAudienceStep({
  audienceMode,
  onSetAudienceMode,
  audienceDescription,
  onAudienceDescriptionChange,
  onSuggestAudience,
  suggestingAudience,
  audienceError,
  audienceApplied,
  audienceNotes,
  locationKey,
  locationLabel,
  onSetLocation,
  radiusKm,
  onRadiusChange,
  ageMin,
  ageMax,
  onAgeMinChange,
  onAgeMaxChange,
  selectedInterests,
  onAddInterest,
  onRemoveInterest,
  savedAudiences,
  onApplySavedAudience,
  showSaveAudience,
  onShowSaveAudience,
  saveAudienceName,
  onSaveAudienceNameChange,
  onSaveAudience,
  savingAudience,
}: {
  audienceMode: AudienceMode;
  onSetAudienceMode: (mode: AudienceMode) => void;
  audienceDescription: string;
  onAudienceDescriptionChange: (value: string) => void;
  onSuggestAudience: () => void;
  suggestingAudience: boolean;
  audienceError: string | null;
  audienceApplied: boolean;
  audienceNotes: string | null;
  locationKey: string | null;
  locationLabel: string | null;
  onSetLocation: (key: string | null, label: string | null) => void;
  radiusKm: number;
  onRadiusChange: (value: number) => void;
  ageMin: number;
  ageMax: number;
  onAgeMinChange: (value: number) => void;
  onAgeMaxChange: (value: number) => void;
  selectedInterests: Interest[];
  onAddInterest: (interest: Interest) => void;
  onRemoveInterest: (id: string) => void;
  savedAudiences: SavedAudience[];
  onApplySavedAudience: (audience: SavedAudience) => void;
  showSaveAudience: boolean;
  onShowSaveAudience: () => void;
  saveAudienceName: string;
  onSaveAudienceNameChange: (value: string) => void;
  onSaveAudience: () => void;
  savingAudience: boolean;
}) {
  const { t } = useLanguage();
  const locationSearch = useMetaSearch<LocationSuggestion>("/api/meta-location-search", {
    country: "MX",
  });
  const interestSearch = useMetaSearch<InterestSuggestion>("/api/meta-interest-search");
  const hasAudience = Boolean(locationLabel) || selectedInterests.length > 0 || audienceApplied;

  const paths: { mode: AudienceMode; icon: typeof Sparkles; title: string; subtitle: string }[] = [
    {
      mode: "wit",
      icon: Sparkles,
      title: t("Dejar que Wit la construya", "Let Wit build it"),
      subtitle: t("Recomendado", "Recommended"),
    },
    {
      mode: "manual",
      icon: Target,
      title: t("Definir mi audiencia", "Define my audience"),
      subtitle: t("Ubicación, edad e intereses", "Location, age, and interests"),
    },
    {
      mode: "saved",
      icon: Bookmark,
      title: t("Usar una audiencia guardada", "Use a saved audience"),
      subtitle: savedAudiences.length
        ? t(`${savedAudiences.length} guardadas`, `${savedAudiences.length} saved`)
        : t("Ninguna guardada todavía", "None saved yet"),
    },
  ];

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-wit-blue">
        {t("Audiencia", "Audience")}
      </p>
      <h2 id="campaign-flow-title" className="mt-2 text-2xl font-extrabold text-wit-ink">
        {t("¿Quién debería ver este anuncio?", "Who should see this ad?")}
      </h2>

      <div className="mt-6 grid gap-2.5">
        {paths.map((path) => {
          const Icon = path.icon;
          const selected = audienceMode === path.mode;
          const disabled = path.mode === "saved" && savedAudiences.length === 0;
          return (
            <button
              key={path.mode}
              type="button"
              disabled={disabled}
              onClick={() => onSetAudienceMode(path.mode)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${
                disabled
                  ? "cursor-not-allowed border-wit-ink/8 opacity-40"
                  : selected
                    ? "border-wit-blue bg-wit-blue/[0.04]"
                    : "border-wit-ink/8"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-wit-blue text-white" : "bg-wit-mist/60 text-wit-ink"}`}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-sm text-wit-ink">{path.title}</b>
                <span
                  className={`mt-0.5 block text-xs ${path.mode === "wit" ? "font-bold text-wit-blue" : "text-wit-gray"}`}
                >
                  {path.subtitle}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {audienceMode === "wit" ? (
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-extrabold text-wit-ink">
              {t(
                "Cuéntame brevemente quién es tu cliente ideal.",
                "Briefly tell me who your ideal customer is.",
              )}
            </span>
            <textarea
              value={audienceDescription}
              onChange={(event) => onAudienceDescriptionChange(event.target.value)}
              rows={4}
              maxLength={600}
              placeholder={t(
                "Ej. Dueños y administradores de restaurantes en CDMX, entre 28 y 50 años, interesados en emprendimiento, gastronomía y herramientas para hacer crecer su negocio.",
                "E.g. Owners and managers of restaurants in Mexico City, ages 28-50, interested in entrepreneurship, food, and tools to grow their business.",
              )}
              className="mt-2 w-full resize-none rounded-2xl border border-wit-ink/10 p-3 text-sm outline-none focus:border-wit-blue"
            />
          </label>
          <button
            type="button"
            onClick={onSuggestAudience}
            disabled={!audienceDescription.trim() || suggestingAudience}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-wit-blue px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            {suggestingAudience ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {suggestingAudience
              ? t("Wit está pensando...", "Wit is thinking...")
              : t("Crear audiencia con Wit", "Create audience with Wit")}
          </button>
          {audienceError ? (
            <p className="text-xs text-red-600" role="alert">
              {audienceError}
            </p>
          ) : null}
          {audienceApplied ? (
            <div className="rounded-2xl border border-wit-blue/20 bg-wit-blue/[0.035] p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-wit-blue" />
                <b className="text-sm text-wit-ink">
                  {t("Audiencia sugerida por Wit", "Audience suggested by Wit")}
                </b>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-wit-ink">
                <li className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-wit-gray" />
                  {locationLabel
                    ? t(`${locationLabel} + ${radiusKm} km`, `${locationLabel} + ${radiusKm} km`)
                    : t("Todo México", "All of Mexico")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3.5 shrink-0 text-center text-xs">👤</span>
                  {t(`${ageMin}–${ageMax} años`, `${ageMin}–${ageMax} years old`)}
                </li>
                {selectedInterests.length ? (
                  <li className="flex items-start gap-2">
                    <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-wit-gray" />
                    <span>{selectedInterests.map((i) => i.name).join(" · ")}</span>
                  </li>
                ) : null}
              </ul>
              {audienceNotes ? (
                <p className="mt-2 text-xs leading-relaxed text-wit-gray">{audienceNotes}</p>
              ) : null}
              <button
                type="button"
                onClick={() => onSetAudienceMode("manual")}
                className="mt-3 text-xs font-bold text-wit-blue"
              >
                {t("Editar", "Edit")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {audienceMode === "manual" ? (
        <div className="mt-5 space-y-5">
          <div>
            <span className="text-sm font-extrabold text-wit-ink">
              {t("Ubicación", "Location")}
            </span>
            {locationLabel ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-wit-ink/10 p-3">
                <span className="flex items-center gap-2 text-sm font-bold text-wit-ink">
                  <MapPin className="h-4 w-4 text-wit-blue" />
                  {locationLabel}
                </span>
                <button
                  type="button"
                  onClick={() => onSetLocation(null, null)}
                  className="text-xs font-bold text-wit-gray hover:text-wit-ink"
                >
                  {t("Quitar", "Remove")}
                </button>
              </div>
            ) : (
              <div className="relative mt-2">
                <input
                  value={locationSearch.query}
                  onChange={(event) => locationSearch.setQuery(event.target.value)}
                  placeholder={t("Ciudad, colonia o código postal", "City, neighborhood, or zip")}
                  className="h-12 w-full rounded-2xl border border-wit-ink/10 px-4 text-sm outline-none focus:border-wit-blue"
                />
                {locationSearch.loading ? (
                  <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-wit-gray" />
                ) : null}
                {locationSearch.results.length ? (
                  <div className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-2xl border border-wit-ink/10 bg-white shadow-lg">
                    {locationSearch.results.map((result) => (
                      <button
                        key={result.key}
                        type="button"
                        onClick={() => {
                          onSetLocation(result.key, result.name);
                          locationSearch.clear();
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-wit-mist/40"
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-wit-gray" />
                        <span className="min-w-0 flex-1 truncate text-wit-ink">
                          {result.name}
                          {result.region ? (
                            <span className="text-wit-gray"> · {result.region}</span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            {locationLabel ? (
              <label className="mt-2 block text-xs font-bold text-wit-gray">
                {t(`Radio: ${radiusKm} km`, `Radius: ${radiusKm} km`)}
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={radiusKm}
                  onChange={(event) => onRadiusChange(Number(event.target.value))}
                  className="mt-1 block w-full accent-wit-blue"
                />
              </label>
            ) : (
              <p className="mt-1.5 text-xs text-wit-gray">{t("Todo México", "All of Mexico")}</p>
            )}
          </div>

          <div>
            <span className="text-sm font-extrabold text-wit-ink">{t("Edad", "Age")}</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs font-bold text-wit-gray">
                {t("Mínima", "Min")}
                <input
                  type="number"
                  min={13}
                  max={65}
                  value={ageMin}
                  onChange={(event) => onAgeMinChange(Number(event.target.value))}
                  className="mt-1 h-11 w-full rounded-xl border border-wit-ink/10 px-3 text-wit-ink"
                />
              </label>
              <label className="text-xs font-bold text-wit-gray">
                {t("Máxima", "Max")}
                <input
                  type="number"
                  min={13}
                  max={65}
                  value={ageMax}
                  onChange={(event) => onAgeMaxChange(Number(event.target.value))}
                  className="mt-1 h-11 w-full rounded-xl border border-wit-ink/10 px-3 text-wit-ink"
                />
              </label>
            </div>
          </div>

          <div>
            <span className="text-sm font-extrabold text-wit-ink">
              {t("Intereses", "Interests")}
            </span>
            <div className="relative mt-2">
              <input
                value={interestSearch.query}
                onChange={(event) => interestSearch.setQuery(event.target.value)}
                placeholder={t(
                  "Ej. derecho, restaurantes, marketing...",
                  "E.g. law, restaurants, marketing...",
                )}
                className="h-12 w-full rounded-2xl border border-wit-ink/10 px-4 text-sm outline-none focus:border-wit-blue"
              />
              {interestSearch.loading ? (
                <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-wit-gray" />
              ) : null}
              {interestSearch.results.length ? (
                <div className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-2xl border border-wit-ink/10 bg-white shadow-lg">
                  {interestSearch.results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        onAddInterest({ id: result.id, name: result.name });
                        interestSearch.clear();
                      }}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-wit-mist/40"
                    >
                      <span className="min-w-0 flex-1 truncate text-wit-ink">{result.name}</span>
                      {result.audienceSize ? (
                        <span className="shrink-0 text-[11px] text-wit-gray">
                          {result.audienceSize.toLocaleString()}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {selectedInterests.length ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {selectedInterests.map((interest) => (
                  <span
                    key={interest.id}
                    className="flex items-center gap-1 rounded-full bg-wit-mist/50 px-2.5 py-1 text-xs font-bold text-wit-ink"
                  >
                    {interest.name}
                    <button
                      type="button"
                      onClick={() => onRemoveInterest(interest.id)}
                      aria-label={t(`Quitar ${interest.name}`, `Remove ${interest.name}`)}
                      className="text-wit-gray hover:text-wit-ink"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {audienceMode === "saved" ? (
        <div className="mt-5 space-y-2">
          {savedAudiences.map((audience) => (
            <button
              key={audience.id}
              type="button"
              onClick={() => onApplySavedAudience(audience)}
              className="flex w-full items-center justify-between rounded-2xl border border-wit-ink/8 p-4 text-left hover:border-wit-blue/40"
            >
              <span className="min-w-0">
                <b className="block truncate text-sm text-wit-ink">{audience.name}</b>
                <span className="mt-0.5 block truncate text-xs text-wit-gray">
                  {[
                    `${audience.ageMin}-${audience.ageMax}`,
                    audience.locationLabel ?? t("Todo México", "All of Mexico"),
                  ].join(" · ")}
                </span>
              </span>
              <Bookmark className="h-4 w-4 shrink-0 text-wit-blue" />
            </button>
          ))}
        </div>
      ) : null}

      {hasAudience && audienceMode !== "wit" ? (
        <div className="mt-5">
          {showSaveAudience ? (
            <div className="flex items-center gap-2">
              <input
                value={saveAudienceName}
                onChange={(event) => onSaveAudienceNameChange(event.target.value)}
                placeholder={t("Ej. Dueños de restaurantes CDMX", "E.g. Restaurant owners CDMX")}
                className="h-11 min-w-0 flex-1 rounded-xl border border-wit-ink/10 px-3 text-sm"
              />
              <button
                type="button"
                onClick={onSaveAudience}
                disabled={!saveAudienceName.trim() || savingAudience}
                className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-wit-blue px-4 text-xs font-bold text-white disabled:opacity-40"
              >
                {savingAudience ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("Guardar", "Save")
                )}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onShowSaveAudience}
              className="text-sm font-bold text-wit-blue"
            >
              {t("Guardar esta audiencia", "Save this audience")}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
