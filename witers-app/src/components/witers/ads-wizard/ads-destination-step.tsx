import type { ReactNode } from "react";
import { Check, Facebook, Globe, Instagram, Loader2, MessageCircle } from "lucide-react";

import { useLanguage } from "../../../lib/i18n";
import type {
  MessagingChannel,
  Objective,
  SocialConnections,
  TrafficDestination,
  WhatsAppNumber,
} from "./types";

function maskPhone(display: string): string {
  const digits = display.replace(/\D/g, "");
  if (digits.length < 4) return display;
  return `+${digits.slice(0, digits.length - 4)} •••• ${digits.slice(-4)}`;
}

function DestinationCard({
  icon,
  title,
  subtitle,
  connected,
  selected,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
  connected: boolean | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex w-full items-center gap-3.5 rounded-[22px] border p-4 text-left transition-colors ${
        selected ? "border-wit-blue bg-wit-blue/[0.04]" : "border-wit-ink/8 hover:border-wit-ink/15"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${selected ? "bg-wit-blue text-white" : "bg-wit-mist/60 text-wit-ink"}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] text-wit-ink">{title}</b>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-wit-gray">
          {connected === true ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {subtitle}
            </>
          ) : connected === false ? (
            <span className="text-wit-gray">{subtitle}</span>
          ) : (
            subtitle
          )}
        </span>
      </span>
      {selected ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-wit-blue text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}

export function AdsDestinationStep({
  objective,
  trafficDestination,
  onSelectTrafficDestination,
  websiteUrl,
  onWebsiteUrlChange,
  messagingChannels,
  onToggleMessagingChannel,
  social,
  whatsappNumber,
  onWhatsappNumberChange,
  whatsappNumbers,
  whatsappLoading,
  whatsappFetchFailed,
  whatsappNeedsReconnect,
  onConnectMeta,
  onConnectSocial,
}: {
  objective: Objective;
  trafficDestination: TrafficDestination | null;
  onSelectTrafficDestination: (value: TrafficDestination) => void;
  websiteUrl: string;
  onWebsiteUrlChange: (value: string) => void;
  messagingChannels: MessagingChannel[];
  onToggleMessagingChannel: (channel: MessagingChannel) => void;
  social: SocialConnections;
  whatsappNumber: string;
  onWhatsappNumberChange: (value: string) => void;
  whatsappNumbers: WhatsAppNumber[];
  whatsappLoading: boolean;
  whatsappFetchFailed: boolean;
  whatsappNeedsReconnect: boolean;
  onConnectMeta: () => void;
  onConnectSocial: () => void;
}) {
  const { t } = useLanguage();

  if (objective === "trafico") {
    return (
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-wit-blue">
          {t("Destino", "Destination")}
        </p>
        <h2 id="campaign-flow-title" className="mt-2 text-2xl font-extrabold text-wit-ink">
          {t("¿A dónde quieres llevar a las personas?", "Where do you want to send people?")}
        </h2>
        <div className="mt-6 grid gap-3">
          <DestinationCard
            icon={<Globe className="h-5 w-5" />}
            title={t("Sitio web", "Website")}
            subtitle={t("Tu página o tienda en línea", "Your website or online store")}
            connected={null}
            selected={trafficDestination === "website"}
            onClick={() => onSelectTrafficDestination("website")}
          />
          <DestinationCard
            icon={<Instagram className="h-5 w-5" />}
            title={t("Perfil de Instagram", "Instagram profile")}
            subtitle={
              social.instagram ? `@${social.instagram.name}` : t("No conectado", "Not connected")
            }
            connected={Boolean(social.instagram)}
            selected={trafficDestination === "instagram_profile"}
            onClick={() => onSelectTrafficDestination("instagram_profile")}
          />
          <DestinationCard
            icon={<Facebook className="h-5 w-5" />}
            title={t("Página de Facebook", "Facebook Page")}
            subtitle={social.facebook ? social.facebook.name : t("No conectado", "Not connected")}
            connected={Boolean(social.facebook)}
            selected={trafficDestination === "facebook_page"}
            onClick={() => onSelectTrafficDestination("facebook_page")}
          />
        </div>
        {trafficDestination === "website" ? (
          <label className="mt-4 block">
            <span className="text-xs font-bold text-wit-gray">
              {t("URL del sitio", "Website URL")}
            </span>
            <input
              value={websiteUrl}
              onChange={(event) => onWebsiteUrlChange(event.target.value)}
              placeholder="https://"
              inputMode="url"
              className="mt-1.5 h-12 w-full rounded-2xl border border-wit-ink/10 px-4 text-sm outline-none focus:border-wit-blue"
            />
          </label>
        ) : null}
        {trafficDestination &&
        trafficDestination !== "website" &&
        !(trafficDestination === "instagram_profile" ? social.instagram : social.facebook) ? (
          <div className="mt-4 rounded-2xl border border-dashed border-wit-ink/15 p-4">
            <p className="text-sm text-wit-gray">
              {trafficDestination === "instagram_profile"
                ? t(
                    "Necesitamos conectar Instagram para llevar tráfico a tu perfil.",
                    "We need to connect Instagram to send traffic to your profile.",
                  )
                : t(
                    "Necesitamos conectar tu Página de Facebook para llevar tráfico ahí.",
                    "We need to connect your Facebook Page to send traffic there.",
                  )}
            </p>
            <button
              type="button"
              onClick={onConnectSocial}
              className="mt-2.5 rounded-full bg-wit-blue px-4 py-2 text-xs font-bold text-white"
            >
              {t("Conectar", "Connect")}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  // objective === "ventas" (messaging) — "interaccion" never reaches here
  // selectable (see AdsObjectiveStep), so this branch only needs to cover
  // the one real messaging objective.
  let whatsappSubtitle: ReactNode = t("No conectado", "Not connected");
  if (whatsappLoading) {
    whatsappSubtitle = (
      <span className="flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("Buscando...", "Looking up...")}
      </span>
    );
  } else if (whatsappNumbers.length) {
    whatsappSubtitle = whatsappNumber
      ? maskPhone(whatsappNumber)
      : t(
          `${whatsappNumbers.length} números disponibles`,
          `${whatsappNumbers.length} numbers available`,
        );
  }

  const whatsappNeedsAction =
    !whatsappLoading &&
    !whatsappFetchFailed &&
    (whatsappNeedsReconnect || whatsappNumbers.length === 0);
  const needsPageConnection =
    (messagingChannels.includes("instagram_direct") && !social.instagram) ||
    (messagingChannels.includes("messenger") && !social.facebook);

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-wit-blue">
        {t("Destino", "Destination")}
      </p>
      <h2 id="campaign-flow-title" className="mt-2 text-2xl font-extrabold text-wit-ink">
        {t("¿Dónde quieres recibir los mensajes?", "Where do you want to receive messages?")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-wit-gray">
        {t(
          "Elige la plataforma donde quieres conversar con tus clientes.",
          "Choose the platform where you want to chat with your customers.",
        )}
      </p>
      <div className="mt-6 grid gap-3">
        <DestinationCard
          icon={<MessageCircle className="h-5 w-5" />}
          title="WhatsApp"
          subtitle={whatsappSubtitle}
          connected={whatsappLoading ? null : whatsappNumbers.length > 0}
          selected={messagingChannels.includes("whatsapp")}
          onClick={() => onToggleMessagingChannel("whatsapp")}
        />
        <DestinationCard
          icon={<Instagram className="h-5 w-5" />}
          title={t("Instagram", "Instagram")}
          subtitle={
            social.instagram ? t("Conectado", "Connected") : t("No conectado", "Not connected")
          }
          connected={Boolean(social.instagram)}
          selected={messagingChannels.includes("instagram_direct")}
          onClick={() => onToggleMessagingChannel("instagram_direct")}
        />
        <DestinationCard
          icon={<Facebook className="h-5 w-5" />}
          title="Messenger"
          subtitle={
            social.facebook ? t("Conectado", "Connected") : t("No conectado", "Not connected")
          }
          connected={Boolean(social.facebook)}
          selected={messagingChannels.includes("messenger")}
          onClick={() => onToggleMessagingChannel("messenger")}
        />
      </div>

      {messagingChannels.includes("whatsapp") && whatsappFetchFailed ? (
        <div className="mt-4 rounded-2xl border border-dashed border-wit-ink/15 p-4">
          <p className="text-sm text-wit-gray">
            {t(
              "No pudimos consultar tus números de WhatsApp en este momento.",
              "We couldn't look up your WhatsApp numbers right now.",
            )}
          </p>
        </div>
      ) : null}

      {messagingChannels.includes("whatsapp") && whatsappNeedsAction ? (
        <div className="mt-4 rounded-2xl border border-dashed border-wit-ink/15 p-4">
          <p className="text-sm text-wit-gray">
            {t(
              "Necesitamos conectar WhatsApp para recibir mensajes aquí.",
              "We need to connect WhatsApp to receive messages here.",
            )}
          </p>
          <button
            type="button"
            onClick={onConnectMeta}
            className="mt-2.5 rounded-full bg-wit-blue px-4 py-2 text-xs font-bold text-white"
          >
            {t("Conectar", "Connect")}
          </button>
        </div>
      ) : null}

      {messagingChannels.includes("whatsapp") &&
      !whatsappNeedsAction &&
      whatsappNumbers.length > 1 ? (
        <div className="mt-4 space-y-2">
          <span className="text-xs font-bold text-wit-gray">
            {t("Elige el número", "Choose the number")}
          </span>
          {whatsappNumbers.map((number) => (
            <label
              key={number.phoneNumberId}
              className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border p-3 text-sm ${
                whatsappNumber === number.displayNumber
                  ? "border-wit-blue bg-wit-blue/[0.04]"
                  : "border-wit-ink/10"
              }`}
            >
              <input
                type="radio"
                name="whatsapp-number"
                checked={whatsappNumber === number.displayNumber}
                onChange={() => onWhatsappNumberChange(number.displayNumber)}
                className="h-4 w-4 accent-wit-blue"
              />
              <span className="min-w-0 flex-1">
                <b className="block text-wit-ink">{number.displayNumber}</b>
                {number.verifiedName ? (
                  <span className="block truncate text-xs text-wit-gray">
                    {number.verifiedName}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {needsPageConnection ? (
        <div className="mt-4 rounded-2xl border border-dashed border-wit-ink/15 p-4">
          <p className="text-sm text-wit-gray">
            {t(
              "Necesitamos conectar tu Página de Facebook e Instagram para recibir mensajes ahí.",
              "We need to connect your Facebook Page and Instagram to receive messages there.",
            )}
          </p>
          <button
            type="button"
            onClick={onConnectSocial}
            className="mt-2.5 rounded-full bg-wit-blue px-4 py-2 text-xs font-bold text-white"
          >
            {t("Conectar", "Connect")}
          </button>
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-relaxed text-wit-gray">
        {t(
          "Tus conversaciones llegarán directamente a la plataforma que elijas.",
          "Your conversations will land directly on the platform you choose.",
        )}
      </p>
    </div>
  );
}
