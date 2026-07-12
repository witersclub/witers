import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { WitersLogo } from "../components/witers/brand";
import { ChatIntakeFlow } from "../components/witers/chat-intake";
import {
  AgeRangeMultiPicker,
  AspectRatioPicker,
  AudiencePicker,
  BusinessTypeWheel,
  ColorsPicker,
  LogoUploadPicker,
  PieceTypePicker,
  ProductPhotoUploadPicker,
  StylePicker,
} from "../components/witers/lab-pickers";

export const Route = createFileRoute("/admin-lab")({
  head: () => ({
    meta: [{ title: "Laboratorio IA. WITERS" }, { name: "robots", content: "noindex" }],
  }),
  component: AiLab,
});

type Fields = {
  title: string;
  companyName: string;
  productName: string;
  pieceBrief: string;
  style: string;
  pieceType: string;
  businessType: string;
  aspectRatio: string;
  audience: string;
  ageRanges: string[];
  logoKey: string;
  productPhotoKey: string;
  promoPrice: string;
  requiredText: string;
  colors: string[];
  missingInfo: string[];
};

// One question per field the real form needs — the conversation IS the
// form, asked one thing at a time instead of dumped as a wall of inputs.
// The raw answers get stitched into a transcript and handed to the same
// /api/admin/ai-fill endpoint the freeform lab used, which normalizes
// what's left as genuinely free text (pieceBrief, etc).
// pieceType/aspectRatio/colors/style/businessType/audience/ageRanges/
// logoKey/productPhotoKey are answered through dedicated pickers instead of
// free text, so those are never sent through the AI at all — see generate()
// below, which merges them straight from `answers` into the final Fields.
// `brief` (what the business does) was dropped entirely — businessType
// covers that ground now, and the field caused more friction than value.
const QUESTIONS: {
  field: string;
  label: string;
  short: string;
  text: string;
  required: boolean;
}[] = [
  {
    field: "pieceType",
    label: "Tipo de pieza",
    short: "Tipo",
    text: "¿Qué tipo de pieza quieres crear hoy?",
    required: false,
  },
  {
    field: "aspectRatio",
    label: "Formato",
    short: "Formato",
    text: "¿Qué forma tiene la pieza que te imaginas?",
    required: false,
  },
  {
    field: "companyName",
    label: "Empresa",
    short: "Empresa",
    text: "¿Cuál es el nombre de tu empresa o marca?",
    required: true,
  },
  {
    field: "colors",
    label: "Colores de marca",
    short: "Colores",
    text: "¿Tienes colores de marca que debamos usar? Si no tienes, elige los que más te gusten.",
    required: true,
  },
  {
    field: "style",
    label: "Estilo",
    short: "Estilo",
    text: "¿Qué estilo visual te gustaría para tu pieza?",
    required: true,
  },
  {
    field: "businessType",
    label: "Categoría de negocio",
    short: "Categoría",
    text: "¿En qué categoría cae tu negocio?",
    required: true,
  },
  {
    field: "pieceBrief",
    label: "Qué debe mostrar la pieza",
    short: "La pieza",
    text: "¿Qué quieres que muestre esta pieza en concreto?",
    required: true,
  },
  {
    field: "title",
    label: "Título de la pieza",
    short: "Título",
    text: "Si le pusieras un título corto a esta pieza, ¿cuál sería?",
    required: true,
  },
  {
    field: "audience",
    label: "Público objetivo",
    short: "Público",
    text: "¿A quién quieres llegarle con esta pieza?",
    required: true,
  },
  {
    field: "ageRanges",
    label: "Rango de edad",
    short: "Edad",
    text: "¿En qué rango de edad está tu público? Elige uno o varios.",
    required: false,
  },
  {
    field: "logoKey",
    label: "Logotipo",
    short: "Logo",
    text: "Sube tu logotipo.",
    required: true,
  },
  {
    field: "productPhotoKey",
    label: "Foto del producto",
    short: "Foto",
    text: "¿Tienes una foto del producto que debamos usar?",
    required: false,
  },
  {
    field: "promoPrice",
    label: "Precio o descuento",
    short: "Precio",
    text: "¿Hay algún precio o descuento que quieras destacar? Si no aplica, dime que no.",
    required: false,
  },
  {
    field: "requiredText",
    label: "Texto obligatorio",
    short: "Texto",
    text: "¿Hay algún texto o dato que deba aparecer sí o sí en la pieza?",
    required: false,
  },
];

function buildTranscript(answers: Record<string, string>): string {
  return QUESTIONS.map((q) => {
    const v = (answers[q.field] ?? "").trim();
    return `${q.label}: ${v || "(no especificado)"}`;
  }).join("\n");
}

function usePlatformUser() {
  return useQuery({
    queryKey: ["platform-user"],
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      const body = (await res.json()) as { ok: boolean; user?: { role?: string } };
      if (!body.ok || body.user?.role !== "admin") return null;
      return body.user as Record<string, unknown>;
    },
    staleTime: 30_000,
  });
}

function AiLab() {
  const platform = usePlatformUser();
  const [fields, setFields] = useState<Fields | null>(null);
  const [loading, setLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  // Bumped on restart() to fully remount ChatIntakeFlow — the cleanest way
  // to wipe its internal conversation/mic state (answers, stepIndex, edit
  // popups, etc.) without exposing all of that back up to this component.
  const [resetKey, setResetKey] = useState(0);

  // `capturedAnswers` is passed in explicitly (not read from a closure)
  // because ChatIntakeFlow may call this again later (editing an answer
  // after the conversation is done), always with the full, current set.
  async function generate(capturedAnswers: Record<string, string>) {
    setLoading(true);
    setGenError(null);
    setFields(null);
    try {
      const res = await fetch("/api/admin/ai-fill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: buildTranscript(capturedAnswers) }),
      });
      const data = (await res.json()) as { ok: boolean; fields?: Fields; error?: string };
      if (!data.ok || !data.fields) {
        setGenError(
          data.error === "falta_openai_api_key"
            ? "Falta configurar OPENAI_API_KEY en el Worker."
            : "No pudimos generar los campos. Intenta de nuevo.",
        );
        return;
      }
      // pieceType/aspectRatio/colors/style came from dedicated pickers, not
      // free text — use the exact values the client chose instead of
      // whatever the AI guessed from the transcript (it isn't even asked
      // for these).
      setFields({
        ...data.fields,
        pieceType: capturedAnswers.pieceType ?? "",
        aspectRatio: capturedAnswers.aspectRatio ?? "",
        style: capturedAnswers.style ?? "",
        businessType: capturedAnswers.businessType ?? "",
        audience: capturedAnswers.audience ?? "",
        logoKey: capturedAnswers.logoKey ?? "",
        productPhotoKey: capturedAnswers.productPhotoKey ?? "",
        colors: (capturedAnswers.colors ?? "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        ageRanges: (capturedAnswers.ageRanges ?? "")
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
      });
    } catch {
      setGenError("No pudimos generar los campos. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function restart() {
    setFields(null);
    setGenError(null);
    setResetKey((k) => k + 1);
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
          Este laboratorio requiere una cuenta con rol de administrador.
        </p>
        <Link
          to="/ingresar"
          className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
        >
          Iniciar sesión de administrador
        </Link>
      </div>
    );
  }

  // Tipo de pieza, formato y colores se contestan con un selector visual en
  // vez del campo de texto/mic — más fácil para un cliente que no sabe qué
  // es un hex o un aspect ratio, y elimina la necesidad de que la IA
  // adivine esos datos.
  function pickerFor(field: string, onPick: (value: string) => void) {
    switch (field) {
      case "pieceType":
        return <PieceTypePicker onPick={onPick} />;
      case "aspectRatio":
        return <AspectRatioPicker onPick={onPick} />;
      case "colors":
        return <ColorsPicker onPick={onPick} />;
      case "style":
        return <StylePicker onPick={onPick} />;
      case "businessType":
        return <BusinessTypeWheel onPick={onPick} />;
      case "audience":
        return <AudiencePicker onPick={onPick} />;
      case "ageRanges":
        return <AgeRangeMultiPicker onPick={onPick} />;
      case "logoKey":
        return <LogoUploadPicker onPick={onPick} />;
      case "productPhotoKey":
        return <ProductPhotoUploadPicker onPick={onPick} />;
      default:
        return null;
    }
  }

  return (
    <div className="wit-page min-h-dvh">
      <header className="wit-glass border-b border-wit-ink/10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link to="/">
              <WitersLogo compact />
            </Link>
            <span className="rounded-full bg-wit-mist/60 px-3 py-1 text-xs font-bold text-wit-blue">
              LAB · SOLO ADMIN
            </span>
          </div>
          <Link to="/admin" className="wit-navlink text-sm font-medium text-wit-ink">
            ← Volver al panel
          </Link>
        </div>
      </header>

      <main className="mx-auto flex h-[calc(100dvh-4rem)] max-w-sm flex-col px-5">
        <ChatIntakeFlow
          key={resetKey}
          questions={QUESTIONS}
          pickerFor={pickerFor}
          onComplete={generate}
          pending={loading}
          pendingLabel="Generando tu solicitud..."
          doneLabel="¡Listo! Esto armé con tus respuestas:"
          externalError={genError}
          restart={restart}
          resultSlot={
            fields ? (
              <div className="wit-glass w-full rounded-2xl p-6 text-left shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
                <h2 className="text-base font-bold text-wit-ink">Campos que llenó la IA</h2>
                <dl className="mt-4 space-y-4">
                  <LabRow label="Título" value={fields.title} />
                  <LabRow label="Nombre comercial / empresa" value={fields.companyName} />
                  <LabRow label="Nombre del producto" value={fields.productName} />
                  <LabRow label="Categoría de negocio" value={fields.businessType} />
                  <LabRow label="Qué quieres que salga en esta pieza" value={fields.pieceBrief} />
                  <LabRow label="Público objetivo" value={fields.audience} />
                  <LabRow label="Rango de edad" value={fields.ageRanges.join(", ")} />
                  <ImageLabRow label="Logotipo" fileKey={fields.logoKey} emptyText="Sin logotipo" />
                  <ImageLabRow
                    label="Foto del producto"
                    fileKey={fields.productPhotoKey}
                    emptyText="—"
                  />
                  <LabRow label="Precio o descuento" value={fields.promoPrice} />
                  <LabRow label="Mensaje o dato extra" value={fields.requiredText} />
                  <LabRow label="Estilo" value={fields.style} />
                  <LabRow label="Tipo de pieza" value={fields.pieceType} />
                  <LabRow label="Formato" value={fields.aspectRatio} />
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
                      Colores de marca
                    </dt>
                    <dd className="mt-1.5 flex gap-2">
                      {fields.colors.length ? (
                        fields.colors.map((c) => (
                          <span
                            key={c}
                            className="h-7 w-7 rounded-full border border-wit-ink/10"
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))
                      ) : (
                        <span className="text-sm text-wit-ink">—</span>
                      )}
                    </dd>
                  </div>
                </dl>

                {fields.missingInfo.length ? (
                  <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
                      Le faltó preguntar
                    </p>
                    <ul className="mt-1.5 list-inside list-disc text-sm text-amber-800">
                      {fields.missingInfo.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null
          }
        />
      </main>
    </div>
  );
}

function LabRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-wit-ink">{value || "—"}</dd>
    </div>
  );
}

// fileKey is only ever a real R2 key ("refs/...") when something was
// actually uploaded — anything else (empty, or the "Sin logotipo" sentinel
// LogoUploadPicker submits) falls back to plain text, same as LabRow.
function ImageLabRow({
  label,
  fileKey,
  emptyText,
}: {
  label: string;
  fileKey: string;
  emptyText: string;
}) {
  const hasFile = fileKey.startsWith("refs/");
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">{label}</dt>
      <dd className="mt-1.5 text-sm text-wit-ink">
        {hasFile ? (
          <img
            src={`/api/file?key=${encodeURIComponent(fileKey)}`}
            alt=""
            className="h-16 w-16 rounded-lg border border-wit-ink/10 object-cover"
          />
        ) : (
          fileKey || emptyText
        )}
      </dd>
    </div>
  );
}
