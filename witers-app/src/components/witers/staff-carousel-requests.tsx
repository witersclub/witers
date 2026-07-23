// Staff-facing "solicitudes de carrusel" — the carousel counterpart of
// staff-video-requests.tsx (claim, then deliver each of the 4 láminas
// separately). Self-contained the same way, so witer.tsx only needs a mode
// toggle + this import, not a rewrite.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type CarouselSlide = {
  id: string;
  slide_index: number;
  title: string;
  brief: string;
  delivered_key: string | null;
  delivered_at: string | null;
  change_request_note: string | null;
  change_requested_at: string | null;
};

type StaffCarouselRequest = {
  id: string;
  status: string;
  title: string;
  aspect_ratio: string;
  company_name: string | null;
  brand_colors: string | null;
  claimed_by: string | null;
  claimed_by_name: string | null;
  created_at: string;
  slides_json: string | null;
};

function parseSlides(row: StaffCarouselRequest): CarouselSlide[] {
  if (!row.slides_json) return [];
  try {
    return (JSON.parse(row.slides_json) as CarouselSlide[])
      .filter((s) => s.id)
      .sort((a, b) => a.slide_index - b.slide_index);
  } catch {
    return [];
  }
}

function CarouselTab({
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

export function StaffCarouselRequestsPanel({ me }: { me: string }) {
  const [tab, setTab] = useState<"pendientes" | "mias" | "finalizadas">("pendientes");

  const query = useQuery({
    queryKey: ["staff-carousel-requests"],
    queryFn: async () => {
      const res = await fetch("/api/designer/carousel-requests", { credentials: "include" });
      if (!res.ok) return null;
      return (await res.json()) as { ok: boolean; carouselRequests: StaffCarouselRequest[] };
    },
    refetchInterval: 20_000,
  });

  const rows = query.data?.carouselRequests ?? [];
  const pendientes = rows.filter((r) => !r.claimed_by);
  const mias = rows.filter((r) => r.claimed_by === me && r.status !== "completada");
  const finalizadas = rows.filter((r) => r.status === "completada");
  // Even once "completada", a carousel with a pending change note on any
  // lámina still needs the claimed designer's attention — surfaced inside
  // "Mías"/"Finalizadas" via the badge on that slide, not a separate tab.
  const shown = tab === "pendientes" ? pendientes : tab === "mias" ? mias : finalizadas;

  return (
    <div>
      {query.isLoading ? (
        <div className="mt-6 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-8 flex gap-2 border-b border-wit-ink/10">
            <CarouselTab
              active={tab === "pendientes"}
              onClick={() => setTab("pendientes")}
              label="Sin tomar"
              count={pendientes.length}
            />
            <CarouselTab
              active={tab === "mias"}
              onClick={() => setTab("mias")}
              label="Mías"
              count={mias.length}
            />
            <CarouselTab
              active={tab === "finalizadas"}
              onClick={() => setTab("finalizadas")}
              label="Finalizadas"
              count={finalizadas.length}
            />
          </div>

          {shown.length === 0 ? (
            <div className="wit-glass mt-6 rounded-3xl border border-dashed border-wit-ink/15 p-10 text-center">
              <p className="text-base font-semibold text-wit-ink">
                {tab === "pendientes"
                  ? "No hay carruseles sin tomar."
                  : tab === "mias"
                    ? "No tienes carruseles en proceso."
                    : "Aún no hay carruseles finalizados."}
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {shown.map((r) => (
                <StaffCarouselCard key={r.id} row={r} me={me} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StaffCarouselCard({ row, me }: { row: StaffCarouselRequest; me: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const slides = parseSlides(row);
  const mine = row.claimed_by === me;

  async function claim() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/designer/claim-carousel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ carouselRequestId: row.id }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) setMsg("Alguien más lo acaba de tomar.");
      await qc.invalidateQueries({ queryKey: ["staff-carousel-requests"] });
    } catch {
      setMsg("No pudimos tomarlo. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="wit-glass rounded-2xl p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-wit-ink">{row.title}</p>
          <p className="mt-0.5 text-xs text-wit-gray">
            {row.company_name ? `${row.company_name} · ` : ""}
            {row.aspect_ratio} · {new Date(row.created_at + "Z").toLocaleString("es-MX")}
          </p>
        </div>
        {!row.claimed_by ? (
          <button
            type="button"
            disabled={busy}
            onClick={claim}
            className="shrink-0 rounded-full bg-wit-blue px-4 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
          >
            {busy ? "Tomando..." : "Tomar carrusel"}
          </button>
        ) : (
          <span className="shrink-0 text-xs font-semibold text-wit-gray">
            {mine ? "Tomado por ti" : `Tomado por ${row.claimed_by_name}`}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {slides.map((s) => (
          <CarouselSlideSlot key={s.id} slide={s} carouselRequestId={row.id} canDeliver={mine} />
        ))}
      </div>

      {msg ? <p className="mt-2 text-xs text-red-600">{msg}</p> : null}
    </article>
  );
}

function CarouselSlideSlot({
  slide,
  carouselRequestId,
  canDeliver,
}: {
  slide: CarouselSlide;
  carouselRequestId: string;
  canDeliver: boolean;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function deliver(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const params = new URLSearchParams({
        carouselRequestId,
        slideIndex: String(slide.slide_index),
      });
      const res = await fetch(`/api/admin/deliver-carousel-slide?${params.toString()}`, {
        method: "POST",
        headers: { "content-type": file.type || "image/png" },
        body: file,
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) setMsg("No pudimos subir la lámina.");
      await qc.invalidateQueries({ queryKey: ["staff-carousel-requests"] });
    } catch {
      setMsg("No pudimos subir la lámina.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-wit-ink/10 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-wit-blue">
          Lámina {slide.slide_index}
          {slide.title ? ` — ${slide.title}` : ""}
        </p>
        {slide.change_request_note ? (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold text-white">
            Cambio pedido
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-wit-ink">{slide.brief}</p>

      {slide.change_request_note ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {slide.change_request_note}
        </p>
      ) : null}

      {slide.delivered_key ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-wit-ink/10">
          <img
            src={`/api/file?key=${encodeURIComponent(slide.delivered_key)}`}
            alt={slide.title || `Lámina ${slide.slide_index}`}
            className="aspect-square w-full object-cover"
          />
        </div>
      ) : null}

      {canDeliver ? (
        <div className="mt-3">
          <input
            type="file"
            aria-label={`Archivo para lámina ${slide.slide_index}`}
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void deliver(file);
              e.target.value = "";
            }}
            className="w-full rounded-lg border border-dashed border-wit-ink/20 px-3 py-2 text-xs text-wit-gray file:mr-2 file:rounded-lg file:border-0 file:bg-wit-mist/60 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-wit-blue"
          />
          <p className="mt-1 text-[10px] text-wit-gray">
            {slide.delivered_key ? "Sube otro archivo para reemplazar esta lámina." : ""}
          </p>
        </div>
      ) : null}

      {msg ? <p className="mt-2 text-xs text-red-600">{msg}</p> : null}
    </div>
  );
}
