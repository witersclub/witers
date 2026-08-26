// Staff-facing "solicitudes de video" — the video counterpart of witer.tsx's
// design-request cards (claim, then deliver). Self-contained the same way
// video-requests.tsx is on the client side, so witer.tsx only needs a mode
// toggle + this import, not a rewrite.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { downloadFileByKey } from "../../lib/download-file";

type RawFile = { id: string; original_name: string; r2_key: string };

// A plain same-tab <a href> to a Content-Disposition: attachment URL sends
// an installed home-screen PWA (iOS) into a native file-preview viewer with
// no way back — see download-file.ts. This click-through wrapper keeps the
// same visual list item but downloads via a fetched blob instead.
function DownloadLink({ fileKey, children }: { fileKey: string; children: ReactNode }) {
  const [downloading, setDownloading] = useState(false);
  return (
    <button
      type="button"
      disabled={downloading}
      onClick={async () => {
        setDownloading(true);
        try {
          await downloadFileByKey(fileKey);
        } finally {
          setDownloading(false);
        }
      }}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-wit-ink/10 bg-white px-3.5 py-2.5 text-xs font-semibold text-wit-blue hover:bg-wit-mist/40 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

type StaffVideoRequest = {
  id: string;
  status: string;
  title: string;
  purpose: string;
  platform: string;
  aspect_ratio: string;
  duration_target: string | null;
  tone: string | null;
  music_mood: string | null;
  wants_ai_scenes: number;
  ai_scenes_note: string | null;
  admin_note: string | null;
  claimed_by: string | null;
  claimed_by_name: string | null;
  delivered_key: string | null;
  created_at: string;
  raw_files_json: string | null;
};

function parseRawFiles(row: StaffVideoRequest): RawFile[] {
  if (!row.raw_files_json) return [];
  try {
    return (JSON.parse(row.raw_files_json) as RawFile[]).filter((f) => f.id);
  } catch {
    return [];
  }
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  otro: "Otro",
};

function VideoTab({
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

// adminView swaps the middle tab from "Mías" (claimed by the viewer only)
// to "En proceso" (every claimed-but-not-done request, whoever has it) —
// an admin is monitoring the whole team's queue, not just their own
// personal claims, so filtering to "mine" would hide everything the actual
// designers are working on.
export function StaffVideoRequestsPanel({
  me,
  adminView = false,
}: {
  me: string;
  adminView?: boolean;
}) {
  const [tab, setTab] = useState<"pendientes" | "mias" | "finalizadas">("pendientes");

  const query = useQuery({
    queryKey: ["staff-video-requests"],
    queryFn: async () => {
      const res = await fetch("/api/designer/video-requests", { credentials: "include" });
      if (!res.ok) return null;
      return (await res.json()) as { ok: boolean; videoRequests: StaffVideoRequest[] };
    },
    refetchInterval: 20_000,
  });

  const rows = query.data?.videoRequests ?? [];
  const pendientes = rows.filter((r) => !r.claimed_by);
  const mias = rows.filter(
    (r) => r.status !== "completada" && (adminView ? Boolean(r.claimed_by) : r.claimed_by === me),
  );
  const finalizadas = rows.filter((r) => r.status === "completada");
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
            <VideoTab
              active={tab === "pendientes"}
              onClick={() => setTab("pendientes")}
              label="Sin tomar"
              count={pendientes.length}
            />
            <VideoTab
              active={tab === "mias"}
              onClick={() => setTab("mias")}
              label={adminView ? "En proceso" : "Mías"}
              count={mias.length}
            />
            <VideoTab
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
                  ? "No hay solicitudes de video sin tomar."
                  : tab === "mias"
                    ? adminView
                      ? "No hay videos en proceso."
                      : "No tienes solicitudes de video en proceso."
                    : "Aún no hay videos finalizados."}
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {shown.map((r) => (
                <StaffVideoCard key={r.id} row={r} me={me} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StaffVideoCard({ row, me }: { row: StaffVideoRequest; me: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const rawFiles = parseRawFiles(row);
  const mine = row.claimed_by === me;

  async function claim() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/designer/claim-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoRequestId: row.id }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) setMsg("Alguien más la acaba de tomar.");
      await qc.invalidateQueries({ queryKey: ["staff-video-requests"] });
    } catch {
      setMsg("No pudimos tomarla. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function release() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/designer/release-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoRequestId: row.id }),
      });
      const data = (await res.json()) as { ok: boolean };
      setMsg(
        data.ok
          ? "Soltaste la solicitud — ya está disponible de nuevo."
          : "No pudimos soltarla. Intenta de nuevo.",
      );
      await qc.invalidateQueries({ queryKey: ["staff-video-requests"] });
    } catch {
      setMsg("No pudimos soltarla. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function deliver() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const params = new URLSearchParams({ videoRequestId: row.id });
      if (note.trim()) params.set("adminNote", note.trim());
      const res = await fetch(`/api/admin/deliver-video?${params.toString()}`, {
        method: "POST",
        headers: { "content-type": file.type || "video/mp4" },
        body: file,
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        setFile(null);
        setNote("");
      } else {
        setMsg("No pudimos subir el video.");
      }
      await qc.invalidateQueries({ queryKey: ["staff-video-requests"] });
    } catch {
      setMsg("No pudimos subir el video.");
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
            {PLATFORM_LABEL[row.platform] ?? row.platform} · {row.aspect_ratio}
            {row.duration_target ? ` · ${row.duration_target}` : ""} ·{" "}
            {new Date(row.created_at + "Z").toLocaleString("es-MX")}
          </p>
        </div>
        {!row.claimed_by ? (
          <button
            type="button"
            disabled={busy}
            onClick={claim}
            className="shrink-0 rounded-full bg-wit-blue px-4 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
          >
            {busy ? "Tomando..." : "Tomar solicitud"}
          </button>
        ) : (
          <span className="shrink-0 text-xs font-semibold text-wit-gray">
            {mine ? "Tomada por ti" : `Tomada por ${row.claimed_by_name}`}
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-wit-ink">{row.purpose}</p>

      {row.tone || row.music_mood ? (
        <p className="mt-2 text-xs text-wit-gray">
          {row.tone ? `Tono: ${row.tone}` : ""}
          {row.tone && row.music_mood ? " · " : ""}
          {row.music_mood ? `Música: ${row.music_mood}` : ""}
        </p>
      ) : null}

      {row.wants_ai_scenes ? (
        <p className="mt-2 rounded-xl bg-wit-blue/5 px-3.5 py-2.5 text-xs text-wit-ink">
          <span className="font-bold text-wit-blue">Escenas con IA solicitadas: </span>
          {row.ai_scenes_note}
        </p>
      ) : null}

      {rawFiles.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-wit-gray">
            Metraje del cliente
          </p>
          <div className="mt-2 space-y-2">
            {rawFiles.map((f) => (
              <DownloadLink key={f.id} fileKey={f.r2_key}>
                <span className="truncate text-wit-ink">{f.original_name}</span>
                <span>Descargar</span>
              </DownloadLink>
            ))}
          </div>
        </div>
      ) : null}

      {mine && row.status !== "completada" ? (
        <div className="mt-5 space-y-3 border-t border-wit-ink/10 pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-wit-gray">
            Entregar corte final
          </p>
          <input
            type="file"
            aria-label="Video final"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-dashed border-wit-ink/20 px-3 py-2.5 text-xs text-wit-gray file:mr-2 file:rounded-lg file:border-0 file:bg-wit-mist/60 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-wit-blue"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Nota para el cliente (opcional)"
            className="w-full rounded-xl border border-wit-ink/15 px-3.5 py-2.5 text-xs outline-none focus:border-wit-blue"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!file || busy}
              onClick={deliver}
              className="rounded-full bg-wit-blue px-5 py-2.5 text-xs font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
            >
              {busy ? "Subiendo..." : "Enviar video"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={release}
              className="rounded-full border border-wit-ink/15 px-5 py-2.5 text-xs font-bold text-wit-ink hover:border-wit-ink/30 disabled:opacity-50"
            >
              Soltar solicitud
            </button>
          </div>
        </div>
      ) : null}

      {row.status === "completada" && row.delivered_key ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-wit-ink/10">
          <video
            controls
            preload="metadata"
            className="max-h-64 w-full bg-black"
            src={`/api/file?key=${encodeURIComponent(row.delivered_key)}`}
          />
        </div>
      ) : null}

      {msg ? <p className="mt-2 text-xs text-red-600">{msg}</p> : null}
    </article>
  );
}
