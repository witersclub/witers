import { useState } from "react";
import { Check, Megaphone, MessageCircle, ShoppingCart, Sparkles } from "lucide-react";

import { useLanguage } from "../../../lib/i18n";
import type { Objective } from "./types";

type ObjectiveCard = {
  value: Objective;
  icon: typeof MessageCircle;
  title: string;
  description: string;
  available: boolean;
};

// "interaccion" is real as a stored value but has no distinct backend
// behavior today (see types.ts) — offered here only as a disabled
// "Próximamente" card so the 3-option layout from the reference mockup
// stays intact without pretending a reach/awareness campaign type
// exists yet.
function useObjectiveCards(): ObjectiveCard[] {
  const { t } = useLanguage();
  return [
    {
      value: "ventas",
      icon: MessageCircle,
      title: t("Recibir más mensajes", "Get more messages"),
      description: t(
        "Habla con personas interesadas por WhatsApp, Instagram o Messenger.",
        "Talk to interested people over WhatsApp, Instagram, or Messenger.",
      ),
      available: true,
    },
    {
      value: "trafico",
      icon: ShoppingCart,
      title: t("Conseguir más clientes", "Get more customers"),
      description: t(
        "Lleva personas a tu negocio digital para generar oportunidades o ventas.",
        "Send people to your digital storefront to generate leads or sales.",
      ),
      available: true,
    },
    {
      value: "interaccion",
      icon: Megaphone,
      title: t("Llegar a más personas", "Reach more people"),
      description: t(
        "Haz que más personas descubran tu negocio e interactúen con tu contenido.",
        "Get more people to discover your business and engage with your content.",
      ),
      available: false,
    },
  ];
}

export function AdsObjectiveStep({
  objective,
  onSelect,
}: {
  objective: Objective;
  onSelect: (value: Objective) => void;
}) {
  const { t } = useLanguage();
  const cards = useObjectiveCards();
  const [showRecommendation, setShowRecommendation] = useState(false);
  // A static default, not a live Wit/AI call — building a real
  // recommendation model for this one decision is out of scope for this
  // iteration. "Recibir más mensajes" is offered because it's already
  // this wizard's own long-standing default objective and WITERS'
  // clients most common real use case, not something inferred per-piece.
  const recommended = cards.find((c) => c.value === "ventas")!;

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-wit-blue">
        {t("Campaña", "Campaign")}
      </p>
      <h2 id="campaign-flow-title" className="mt-2 text-2xl font-extrabold text-wit-ink">
        {t("¿Qué quieres conseguir?", "What do you want to achieve?")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-wit-gray">
        {t(
          "¿Qué quieres que pase después de que alguien vea este anuncio?",
          "What do you want to happen after someone sees this ad?",
        )}
      </p>

      <div className="mt-6 grid gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const selected = objective === card.value;
          return (
            <button
              key={card.value}
              type="button"
              disabled={!card.available}
              onClick={() => card.available && onSelect(card.value)}
              aria-pressed={selected}
              className={`relative flex items-start gap-3.5 rounded-[22px] border p-4 text-left transition-colors ${
                !card.available
                  ? "cursor-not-allowed border-wit-ink/8 opacity-50"
                  : selected
                    ? "border-wit-blue bg-wit-blue/[0.04]"
                    : "border-wit-ink/8 hover:border-wit-ink/15"
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${
                  selected ? "bg-wit-blue text-white" : "bg-wit-mist/60 text-wit-ink"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <b className="text-[15px] text-wit-ink">{card.title}</b>
                  {!card.available ? (
                    <span className="rounded-full bg-wit-mist/70 px-2 py-0.5 text-[10px] font-bold text-wit-gray">
                      {t("Próximamente", "Coming soon")}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-wit-gray">
                  {card.description}
                </span>
              </span>
              {selected ? (
                <span className="absolute right-3.5 top-3.5 flex h-5 w-5 items-center justify-center rounded-full bg-wit-blue text-white">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {!showRecommendation ? (
        <button
          type="button"
          onClick={() => setShowRecommendation(true)}
          className="mt-5 flex items-center gap-1.5 text-sm font-bold text-wit-blue"
        >
          <Sparkles className="h-4 w-4" />
          {t("¿No sabes cuál elegir?", "Not sure which to pick?")}
        </button>
      ) : (
        <div className="mt-5 rounded-2xl border border-wit-blue/20 bg-wit-blue/[0.035] p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-wit-blue" />
            <b className="text-sm text-wit-ink">{t("Wit recomienda", "Wit recommends")}</b>
          </div>
          <p className="mt-2 text-sm font-bold text-wit-ink">{recommended.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-wit-gray">
            {t(
              "Esta pieza tiene un llamado directo y puede funcionar mejor generando conversaciones.",
              "This piece has a direct call to action and tends to work best driving conversations.",
            )}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onSelect(recommended.value);
                setShowRecommendation(false);
              }}
              className="flex-1 rounded-full bg-wit-blue px-4 py-2.5 text-xs font-bold text-white"
            >
              {t("Usar recomendación", "Use recommendation")}
            </button>
            <button
              type="button"
              onClick={() => setShowRecommendation(false)}
              className="flex-1 rounded-full border border-wit-ink/10 px-4 py-2.5 text-xs font-bold text-wit-ink"
            >
              {t("Elegir otra opción", "Choose another option")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
