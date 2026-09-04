import { useEffect, useState } from "react";
import { Check, Loader2, ShieldAlert } from "lucide-react";

import { useLanguage } from "../../../lib/i18n";

const STEP_MS = 650;

// The real /api/campaigns-create call is one request/response, not a
// server-sent progress stream — so these 5 rows are a client-side timed
// approximation of what that single call actually does on Meta's side in
// order (create campaign → ad set → creative → ad, all paused). It is
// NEVER allowed to outrun the real result: the final "lista"/error state
// only ever appears once the actual fetch has resolved, never before —
// see the `status` prop below, driven straight from publishCampaign().
export function AdsCreationProgress({
  status,
  errorMessage,
  activated,
  onViewCampaign,
  onDone,
  onRetry,
}: {
  status: "creating" | "success" | "error";
  errorMessage: string | null;
  activated: boolean;
  onViewCampaign: () => void;
  onDone: () => void;
  onRetry: () => void;
}) {
  const { t } = useLanguage();
  const steps = [
    t("Preparando campaña", "Preparing campaign"),
    t("Configurando audiencia", "Setting up audience"),
    t("Preparando anuncio", "Preparing ad"),
    t("Enviando a Meta", "Sending to Meta"),
    t("Verificando configuración", "Verifying setup"),
  ];
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (status !== "creating") return;
    if (stepIndex >= steps.length - 1) return;
    const timer = window.setTimeout(() => setStepIndex((i) => i + 1), STEP_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, stepIndex]);

  useEffect(() => {
    if (status === "success") setStepIndex(steps.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === "success") {
    return (
      <div className="flex min-h-[62dvh] flex-col items-center justify-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="h-10 w-10" strokeWidth={2.5} />
        </span>
        <h2 id="campaign-flow-title" className="mt-6 text-2xl font-extrabold text-wit-ink">
          {activated
            ? t("¡Tu campaña ya está activa!", "Your campaign is now active!")
            : t("Tu campaña está lista", "Your campaign is ready")}
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-wit-gray">
          {activated
            ? t(
                "Se creó y activó en Meta — ya está compitiendo por mostrarse y puede empezar a generar gasto.",
                "It was created and activated on Meta — it's already live and can start spending.",
              )
            : t(
                "Creamos tu campaña y la dejamos pausada para que puedas revisarla antes de activarla.",
                "We created your campaign and left it paused so you can review it before activating it.",
              )}
        </p>
        <button
          type="button"
          onClick={onViewCampaign}
          className="mt-8 min-h-12 w-full rounded-2xl bg-wit-blue px-5 font-bold text-white"
        >
          {t("Ver campaña", "View campaign")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="mt-3 min-h-11 text-sm font-bold text-wit-blue"
        >
          {t("Listo", "Done")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[62dvh] flex-col items-center justify-center text-center">
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full ${status === "error" ? "bg-red-50 text-red-500" : "bg-wit-blue/10 text-wit-blue"}`}
      >
        {status === "error" ? (
          <ShieldAlert className="h-8 w-8" />
        ) : (
          <Loader2 className="h-8 w-8 animate-spin" />
        )}
      </span>
      <h2 id="campaign-flow-title" className="mt-5 text-xl font-extrabold text-wit-ink">
        {status === "error"
          ? t("No pudimos crear tu campaña", "We couldn't create your campaign")
          : t("Estamos creando tu campaña", "We're creating your campaign")}
      </h2>
      <div className="mt-6 w-full max-w-xs space-y-2 text-left">
        {steps.map((label, index) => {
          const done = index < stepIndex;
          const failed = status === "error" && index === stepIndex;
          const active = status === "creating" && index === stepIndex;
          return (
            <div key={label} className="flex items-center gap-2.5 text-sm">
              {done ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : failed ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
                  <ShieldAlert className="h-3 w-3" />
                </span>
              ) : active ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-wit-blue" />
              ) : (
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-wit-ink/15" />
              )}
              <span
                className={done || failed || active ? "font-bold text-wit-ink" : "text-wit-gray"}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      {status === "error" ? (
        <>
          <p className="mt-5 max-w-sm rounded-2xl bg-red-50 p-3 text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 min-h-12 w-full max-w-xs rounded-2xl bg-wit-blue px-5 font-bold text-white"
          >
            {t("Volver a revisión", "Back to review")}
          </button>
        </>
      ) : null}
    </div>
  );
}
