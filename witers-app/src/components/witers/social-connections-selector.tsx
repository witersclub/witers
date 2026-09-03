import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Facebook, Instagram, Music2, Youtube } from "lucide-react";

import { useLanguage } from "../../lib/i18n";

type Platform = "instagram" | "facebook";
type Connections = Record<Platform, { name: string | null } | null>;
const EMPTY: Connections = { instagram: null, facebook: null };

async function fetchConnections(): Promise<Connections> {
  const response = await fetch("/api/social/connections", { credentials: "include" });
  const data = (await response.json()) as { ok: boolean; connections?: Connections };
  return data.ok && data.connections ? data.connections : EMPTY;
}

export function SocialConnectionsSelector() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingPages, setPendingPages] = useState<{ id: string; name: string }[]>([]);
  const [detailsPlatform, setDetailsPlatform] = useState<Platform | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { data: connections = EMPTY } = useQuery({
    queryKey: ["social-connections"],
    queryFn: fetchConnections,
  });

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const pending = url.searchParams.get("social_pick");
    if (url.searchParams.get("social_connected"))
      void queryClient.invalidateQueries({ queryKey: ["social-connections"] });
    if (pending) {
      setPendingId(pending);
      setOpen(true);
      void fetch(`/api/social/connect/pending?id=${encodeURIComponent(pending)}`)
        .then((response) => response.json())
        .then((data: { ok: boolean; pages?: { id: string; name: string }[] }) => {
          if (data.ok) setPendingPages(data.pages ?? []);
        });
    }
    if (
      pending ||
      url.searchParams.get("social_connected") ||
      url.searchParams.get("social_error")
    ) {
      url.searchParams.delete("social_pick");
      url.searchParams.delete("social_connected");
      url.searchParams.delete("social_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [queryClient]);

  async function disconnect(platform: Platform) {
    const label = platform === "instagram" ? "Instagram" : "Facebook";
    if (
      !window.confirm(
        t(
          `¿Desconectar ${label}? Podrás volver a conectarlo después.`,
          `Disconnect ${label}? You can reconnect it later.`,
        ),
      )
    ) {
      return;
    }
    const response = await fetch(`/api/social/connections?platform=${platform}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setDetailsPlatform(null);
      void queryClient.invalidateQueries({ queryKey: ["social-connections"] });
    }
  }

  async function choosePage(pageId: string) {
    if (!pendingId) return;
    const response = await fetch("/api/social/connect/finalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pendingId, pageId }),
    });
    if (response.ok) {
      setPendingId(null);
      setPendingPages([]);
      void queryClient.invalidateQueries({ queryKey: ["social-connections"] });
    }
  }

  const rows = [
    {
      key: "instagram" as const,
      label: "Instagram",
      icon: Instagram,
      iconClass: "text-wit-pink",
      href: "/api/social/connect/instagram/start",
      connection: connections.instagram,
    },
    {
      key: "facebook" as const,
      label: "Facebook",
      icon: Facebook,
      iconClass: "text-[#1877f2]",
      href: "/api/social/connect/start",
      connection: connections.facebook,
    },
  ];
  const upcoming = [
    { label: "TikTok", icon: Music2 },
    { label: "YouTube", icon: Youtube },
  ];

  return (
    <div ref={rootRef} className="relative z-30 w-fit max-w-[60vw] shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("Ver cuentas sociales conectadas", "View connected social accounts")}
        className={`flex h-12 items-center gap-3 rounded-[20px] border bg-white px-3.5 shadow-[0_3px_12px_rgba(5,13,40,0.045)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue focus-visible:ring-offset-2 ${open ? "border-wit-blue/35" : "border-wit-ink/12 hover:border-wit-ink/20"}`}
      >
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <span key={row.key} className="relative flex h-5 w-5 items-center justify-center">
              <Icon
                className={`h-5 w-5 ${row.connection ? row.iconClass : "text-wit-gray/35 grayscale"}`}
                strokeWidth={2.3}
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-white ${row.connection ? "bg-emerald-500" : "bg-wit-gray/35"}`}
              />
            </span>
          );
        })}
        {upcoming.map((row) => {
          const Icon = row.icon;
          return (
            <Icon
              key={row.label}
              className="h-5 w-5 text-wit-gray/35 grayscale"
              strokeWidth={2.3}
              aria-label={row.label}
            />
          );
        })}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-wit-blue transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2.5}
        />
      </button>

      {open ? (
        <section
          role="menu"
          aria-label={t("Cuentas sociales", "Social accounts")}
          className="absolute right-0 top-[calc(100%+8px)] w-[min(320px,calc(100vw-40px))] overflow-hidden rounded-[20px] border border-wit-ink/10 bg-white shadow-[0_12px_40px_rgba(5,13,40,0.12)]"
        >
          {pendingId && pendingPages.length > 0 ? (
            <div className="border-b border-wit-ink/[0.07] px-4 py-3">
              <p className="text-xs font-extrabold text-wit-ink">
                {t("Elige la página de Facebook", "Choose the Facebook Page")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pendingPages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => void choosePage(page.id)}
                    className="min-h-9 rounded-full border border-wit-ink/12 px-3 text-xs font-bold text-wit-blue hover:bg-wit-blue/[0.06]"
                  >
                    {page.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {rows.map((row) => {
            const Icon = row.icon;
            const connected = Boolean(row.connection);
            const expanded = detailsPlatform === row.key;
            return (
              <div key={row.key} className="border-b border-wit-ink/[0.07]">
                {connected ? (
                  <button
                    type="button"
                    role="menuitem"
                    aria-expanded={expanded}
                    onClick={() =>
                      setDetailsPlatform((value) => (value === row.key ? null : row.key))
                    }
                    className="flex min-h-[62px] w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-wit-bg/60"
                  >
                    <Icon className={`h-6 w-6 shrink-0 ${row.iconClass}`} strokeWidth={2.2} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-wit-ink">
                        {row.connection?.name || row.label}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-wit-gray">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {t("Conectada", "Connected")}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-wit-gray transition-transform ${expanded ? "rotate-180" : ""}`}
                      strokeWidth={2.3}
                    />
                  </button>
                ) : (
                  <div className="flex min-h-[62px] items-center gap-3 px-4 py-2.5">
                    <Icon
                      className="h-6 w-6 shrink-0 text-wit-gray/35 grayscale"
                      strokeWidth={2.2}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-wit-ink">{row.label}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-wit-gray/70">
                        <span className="h-2 w-2 rounded-full bg-wit-gray/45" />
                        {t("No conectada", "Not connected")}
                      </p>
                    </div>
                    <a
                      href={row.href}
                      role="menuitem"
                      className="rounded-full px-2 py-2 text-xs font-extrabold text-wit-blue hover:bg-wit-blue/[0.06]"
                    >
                      {t("Conectar", "Connect")}
                    </a>
                  </div>
                )}
                {expanded ? (
                  <div className="bg-wit-bg/60 px-4 pb-3">
                    <p className="text-xs leading-relaxed text-wit-gray">
                      {t(
                        "Esta cuenta se usará cuando publiques contenido en esta red.",
                        "This account will be used when you publish content to this network.",
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => void disconnect(row.key)}
                      className="mt-2 min-h-9 w-full rounded-full border border-red-200 px-3 text-xs font-bold text-red-600 transition hover:bg-red-50"
                    >
                      {t("Desconectar cuenta", "Disconnect account")}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
          {upcoming.map((row, index) => {
            const Icon = row.icon;
            return (
              <div
                key={row.label}
                className={`flex min-h-[62px] items-center gap-3 px-4 py-2.5 ${index ? "" : ""}`}
              >
                <Icon className="h-6 w-6 shrink-0 text-wit-gray/35 grayscale" strokeWidth={2.2} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-wit-ink">{row.label}</p>
                  <p className="mt-0.5 text-xs font-semibold text-wit-gray">
                    {t("Próximamente", "Coming soon")}
                  </p>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
