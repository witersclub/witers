import type { ReactNode } from "react";
import {
  Check,
  Facebook,
  Instagram,
  Link2,
  Loader2,
  MessageCircle,
  ShieldAlert,
} from "lucide-react";

import { useLanguage } from "../../../lib/i18n";
import type { AccountStatus, SocialConnections } from "./types";

type ItemState = "checking" | "ready" | "action_required" | "error";

function ChecklistRow({
  index,
  icon,
  label,
  state,
  actionLabel,
  onAction,
}: {
  index: number;
  icon: ReactNode;
  label: string;
  state: ItemState;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className="wit-rise flex items-center gap-3 rounded-2xl border border-wit-ink/8 px-4 py-3.5"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wit-mist/50 text-wit-gray">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm font-bold text-wit-ink">{label}</span>
      {state === "checking" ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-wit-gray" />
      ) : state === "ready" ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      ) : state === "error" ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
          <ShieldAlert className="h-3.5 w-3.5" />
        </span>
      ) : actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-full bg-wit-blue px-3 py-1.5 text-xs font-bold text-white"
        >
          {actionLabel}
        </button>
      ) : (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-wit-ink/15" />
      )}
    </div>
  );
}

// Paso 0 — a REAL checklist, not a scripted animation pretending to
// verify things WITERS can't actually check yet. Only 4 rows are backed
// by real signals this app already has (ad account OAuth, Facebook Page,
// Instagram, WhatsApp Business numbers) — Meta-side items like payment
// method or full permission grants have no endpoint here to confirm
// them, so rather than fake a checkmark for them, a plain note below
// explains Meta verifies those itself once the campaign is actually
// sent. The container skips this screen entirely when everything here
// is already ready — see CampaignCreationSheet.
export function AdsPreparationStep({
  loadingAccount,
  account,
  social,
  whatsappLoading,
  whatsappFetchFailed,
  whatsappCount,
  onConnectMeta,
}: {
  loadingAccount: boolean;
  account: AccountStatus;
  social: SocialConnections;
  whatsappLoading: boolean;
  whatsappFetchFailed: boolean;
  whatsappCount: number;
  onConnectMeta: () => void;
}) {
  const { t } = useLanguage();

  const items: { icon: ReactNode; label: string; state: ItemState }[] = [
    {
      icon: <Link2 className="h-4 w-4" />,
      label: t("Cuenta publicitaria conectada", "Ad account connected"),
      state: loadingAccount ? "checking" : account.connected ? "ready" : "action_required",
    },
    {
      icon: <Facebook className="h-4 w-4" />,
      label: t("Página de Facebook", "Facebook Page"),
      state: loadingAccount ? "checking" : social.facebook ? "ready" : "action_required",
    },
    {
      icon: <Instagram className="h-4 w-4" />,
      label: t("Instagram", "Instagram"),
      state: loadingAccount ? "checking" : social.instagram ? "ready" : "action_required",
    },
    {
      icon: <MessageCircle className="h-4 w-4" />,
      label: t("WhatsApp Business disponible", "WhatsApp Business available"),
      state: whatsappLoading
        ? "checking"
        : whatsappFetchFailed
          ? "error"
          : whatsappCount > 0
            ? "ready"
            : "action_required",
    },
  ];

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-wit-blue">WITERS ADS</p>
      <h2 id="campaign-flow-title" className="mt-2 text-2xl font-extrabold text-wit-ink">
        {t("Estamos preparando tu cuenta", "We're getting your account ready")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-wit-gray">
        {t(
          "Revisaremos todo lo necesario para que puedas crear campañas desde WITERS.",
          "We'll check everything needed so you can create campaigns from WITERS.",
        )}
      </p>
      <div className="mt-6 space-y-2">
        {items.map((item, index) => (
          <ChecklistRow
            key={item.label}
            index={index}
            icon={item.icon}
            label={item.label}
            state={item.state}
            actionLabel={t("Conectar", "Connect")}
            onAction={onConnectMeta}
          />
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-wit-gray">
        {t(
          "El resto — método de pago y permisos completos — Meta lo confirma directamente cuando enviamos la campaña.",
          "The rest — payment method and full permissions — Meta confirms directly when we submit the campaign.",
        )}
      </p>
      <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-wit-mist/35 p-3.5 text-xs leading-relaxed text-wit-gray">
        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-wit-blue" />
        {t(
          "Esto solo lo hacemos una vez. Tú solo conéctate, nosotros nos encargamos del resto.",
          "We only do this once. You just connect — we handle the rest.",
        )}
      </div>
    </div>
  );
}
