import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, GalleryHorizontal, Image as ImageIcon, Video } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { WitersLogo } from "../components/witers/brand";
import { StaffCarouselRequestsPanel } from "../components/witers/staff-carousel-requests";
import {
  CompactRequestCard,
  PendingCompactCard,
  StaffRequestCard,
  type StaffRequestRow,
} from "../components/witers/staff-request-card";
import { StaffVideoRequestsPanel } from "../components/witers/staff-video-requests";

export const Route = createFileRoute("/witer")({
  head: () => ({
    meta: [{ title: "Diseñadores. WITERS" }, { name: "robots", content: "noindex" }],
  }),
  component: DesignerPanel,
});

type DesignerRequest = StaffRequestRow;

const DESIGNER_REQUESTS_QUERY_KEY = ["designer-requests"] as const;

function useStaffUser() {
  return useQuery({
    queryKey: ["platform-user"],
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      const body = (await res.json()) as { ok: boolean; user?: { role?: string } };
      if (!body.ok || (body.user?.role !== "admin" && body.user?.role !== "designer")) return null;
      return body.user as Record<string, unknown>;
    },
    staleTime: 30_000,
  });
}

function DesignerPanel() {
  const platform = useStaffUser();
  const overview = useQuery({
    queryKey: ["designer-requests"],
    queryFn: async () => {
      const res = await fetch("/api/designer/requests", { credentials: "include" });
      if (!res.ok) return null;
      return (await res.json()) as { ok: boolean; requests: DesignerRequest[]; me: string };
    },
    enabled: Boolean(platform.data),
    refetchInterval: 20_000,
  });
  const stats = useQuery({
    queryKey: ["designer-stats"],
    queryFn: async () => {
      const res = await fetch("/api/designer/stats", { credentials: "include" });
      if (!res.ok) return null;
      return (await res.json()) as {
        ok: boolean;
        images: number;
        videos: number;
        carousels: number;
      };
    },
    enabled: Boolean(platform.data),
    refetchInterval: 20_000,
  });
  const [tab, setTab] = useState<"en_proceso" | "en_revision" | "finalizadas">("en_proceso");
  const [mode, setMode] = useState<"diseno" | "video" | "carrusel">("diseno");
  // Lifted above the individual request cards: a card that just got sent
  // moves out of "En proceso" the instant the list refetches, which would
  // unmount a toast rendered inside it before the client ever saw it. Kept
  // here instead, at the panel level, so it survives that move.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  if (platform.isLoading) {
    return (
      <div className="wit-page flex min-h-dvh items-center justify-center">
        <div className="h-40 w-full max-w-md animate-pulse rounded-3xl bg-wit-mist/40" />
      </div>
    );
  }

  if (!platform.data) {
    return (
      <div className="wit-page flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
        <WitersLogo />
        <p className="max-w-sm text-base text-wit-gray">
          El panel de diseñadores requiere una cuenta de diseñador o administrador. Inicia sesión y
          vuelve a esta página.
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/ingresar";
          }}
          className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
        >
          Iniciar sesión
        </button>
      </div>
    );
  }

  const data = overview.data;

  return (
    <div className="wit-page min-h-dvh">
      <header className="wit-glass border-b border-wit-ink/10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link to="/">
              <WitersLogo compact />
            </Link>
            <span className="rounded-full bg-wit-mist/60 px-3 py-1 text-xs font-bold text-wit-blue">
              DISEÑADORES
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(
                () => {
                  window.location.href = "/";
                },
              );
            }}
            className="wit-navlink text-sm font-medium text-wit-ink"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-3xl font-extrabold tracking-tighter text-wit-ink">
          Solicitudes de{" "}
          <span className="text-wit-blue">
            {mode === "diseno" ? "diseño" : mode === "video" ? "video" : "carrusel"}
          </span>
        </h1>
        <p className="mt-2 text-sm text-wit-gray">
          Toma una solicitud para trabajarla — así nadie más la duplica.
        </p>

        {stats.data?.ok ? <DesignerStreakCard stats={stats.data} /> : null}

        <div className="wit-glass mt-5 inline-flex gap-1 rounded-2xl p-1 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
          <button
            type="button"
            onClick={() => setMode("diseno")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              mode === "diseno"
                ? "bg-wit-blue text-white"
                : "text-wit-gray hover:bg-wit-mist/60 hover:text-wit-ink"
            }`}
          >
            Diseño
          </button>
          <button
            type="button"
            onClick={() => setMode("video")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              mode === "video"
                ? "bg-wit-blue text-white"
                : "text-wit-gray hover:bg-wit-mist/60 hover:text-wit-ink"
            }`}
          >
            Video
          </button>
          <button
            type="button"
            onClick={() => setMode("carrusel")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              mode === "carrusel"
                ? "bg-wit-blue text-white"
                : "text-wit-gray hover:bg-wit-mist/60 hover:text-wit-ink"
            }`}
          >
            Carrusel
          </button>
        </div>

        {mode === "video" ? (
          <StaffVideoRequestsPanel me={String(platform.data.id)} />
        ) : mode === "carrusel" ? (
          <StaffCarouselRequestsPanel me={String(platform.data.id)} />
        ) : overview.isLoading ? (
          <div className="mt-6 space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : !data?.ok ? (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            No pudimos cargar las solicitudes.
          </p>
        ) : data.requests.length === 0 ? (
          <div className="wit-glass mt-6 rounded-3xl border border-dashed border-wit-ink/15 p-10 text-center">
            <p className="text-base font-semibold text-wit-ink">No hay solicitudes todavía.</p>
          </div>
        ) : (
          (() => {
            const enProceso = data.requests.filter((r) => r.status === "en_proceso");
            const enRevision = data.requests.filter((r) => r.status === "completada");
            const finalizadas = data.requests.filter(
              (r) => r.status === "cerrada" || r.status === "rechazada",
            );
            const shown =
              tab === "en_proceso" ? enProceso : tab === "en_revision" ? enRevision : finalizadas;
            return (
              <>
                <div className="mt-8 flex gap-2 border-b border-wit-ink/10">
                  <DesignerTab
                    active={tab === "en_proceso"}
                    onClick={() => setTab("en_proceso")}
                    label="En proceso"
                    count={enProceso.length}
                  />
                  <DesignerTab
                    active={tab === "en_revision"}
                    onClick={() => setTab("en_revision")}
                    label="En revisión"
                    count={enRevision.length}
                  />
                  <DesignerTab
                    active={tab === "finalizadas"}
                    onClick={() => setTab("finalizadas")}
                    label="Finalizadas"
                    count={finalizadas.length}
                  />
                </div>

                {shown.length === 0 ? (
                  <div className="wit-glass mt-6 rounded-3xl border border-dashed border-wit-ink/15 p-10 text-center">
                    <p className="text-base font-semibold text-wit-ink">
                      {tab === "en_proceso"
                        ? "No hay solicitudes en proceso."
                        : tab === "en_revision"
                          ? "No hay piezas en revisión del cliente."
                          : "Aún no hay solicitudes finalizadas."}
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-5">
                    {shown.map((r) =>
                      tab !== "en_proceso" ? (
                        <CompactRequestCard
                          key={r.id}
                          row={r}
                          me={data.me}
                          onSent={showToast}
                          queryKey={DESIGNER_REQUESTS_QUERY_KEY}
                        />
                      ) : r.claimed_by === data.me ? (
                        <StaffRequestCard
                          key={r.id}
                          row={r}
                          me={data.me}
                          onSent={showToast}
                          queryKey={DESIGNER_REQUESTS_QUERY_KEY}
                        />
                      ) : (
                        <PendingCompactCard
                          key={r.id}
                          row={r}
                          me={data.me}
                          queryKey={DESIGNER_REQUESTS_QUERY_KEY}
                        />
                      ),
                    )}
                  </div>
                )}
              </>
            );
          })()
        )}
      </main>

      {toast ? (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-5">
          <span className="rounded-full bg-wit-navy px-5 py-2.5 text-sm font-bold text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            ✓ {toast}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// Every 5 pieces a client finalizes (of one type) fills the bar and pays
// out 100 créditos — a purely motivational counter for now, no payout
// mechanism behind it yet (see the discussion with the client about the
// eventual rewards system). Images use "cerrada" (the client's explicit
// confirm step); video/carousel have no such step, "completada" is
// already their terminal state — see /api/designer/stats.
function DesignerStreakCard({
  stats,
}: {
  stats: { images: number; videos: number; carousels: number };
}) {
  const totalCreditos =
    Math.floor(stats.images / 5) * 100 +
    Math.floor(stats.videos / 5) * 100 +
    Math.floor(stats.carousels / 5) * 100;

  return (
    <div className="wit-glass mt-6 max-w-lg rounded-3xl p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-wit-gray">
          Créditos WITERS
        </p>
        <span className="flex items-center gap-1.5 rounded-full bg-wit-blue/10 px-3 py-1 text-sm font-extrabold text-wit-blue">
          <Award className="h-4 w-4" strokeWidth={2.4} />
          {totalCreditos}
        </span>
      </div>
      <div className="mt-5 space-y-4">
        <DesignerStreakRow
          icon={<ImageIcon className="h-4 w-4" strokeWidth={2.2} />}
          label="Imágenes"
          count={stats.images}
        />
        <DesignerStreakRow
          icon={<Video className="h-4 w-4" strokeWidth={2.2} />}
          label="Videos"
          count={stats.videos}
        />
        <DesignerStreakRow
          icon={<GalleryHorizontal className="h-4 w-4" strokeWidth={2.2} />}
          label="Carruseles"
          count={stats.carousels}
        />
      </div>
    </div>
  );
}

function DesignerStreakRow({
  icon,
  label,
  count,
}: {
  icon: ReactNode;
  label: string;
  count: number;
}) {
  const filled = count % 5;
  const pct = (filled / 5) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wit-mist/50 text-wit-blue">
        {icon}
      </span>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-wit-ink">{label}</p>
          <p className="text-xs font-semibold text-wit-gray">{filled}/5</p>
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-wit-mist/60">
          <div
            className="relative h-full rounded-full bg-wit-blue transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          >
            {filled > 0 ? (
              <span className="wit-energy-tip absolute right-0 top-1/2 h-2.5 w-2.5 rounded-full bg-wit-blue" />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function DesignerTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative -mb-px flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-bold transition-colors ${
        active
          ? "border-wit-blue text-wit-blue"
          : "border-transparent text-wit-gray hover:text-wit-ink"
      }`}
    >
      {label}
      {count > 0 ? (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            active ? "bg-wit-blue/10 text-wit-blue" : "bg-wit-mist/60 text-wit-gray"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
