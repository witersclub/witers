import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, MessageCircleQuestion, Send, UserRound } from "lucide-react";

export type HelpConversationListItem = {
  id: string;
  status: "ia" | "escalada" | "resuelta";
  claimed_by: string | null;
  claimed_by_name: string | null;
  created_at: string;
  updated_at: string;
  client_name: string;
  client_email: string;
  company_name: string | null;
  last_message: string | null;
};

type HelpMessage = {
  id: string;
  role: "user" | "assistant" | "staff";
  content: string;
  created_at: string;
};

type ConversationDetail = {
  conversation: { id: string; status: "ia" | "escalada" | "resuelta" };
  messages: HelpMessage[];
};

const STATUS_META: Record<"ia" | "escalada" | "resuelta", { label: string; cls: string }> = {
  ia: { label: "Con el asistente", cls: "bg-wit-mist/60 text-wit-gray" },
  escalada: { label: "Necesita respuesta", cls: "bg-amber-100 text-amber-700" },
  resuelta: { label: "Resuelta", cls: "bg-emerald-100 text-emerald-700" },
};

function timeAgo(iso: string): string {
  const date = new Date(iso.includes("Z") ? iso : `${iso}Z`);
  const diffMin = Math.round((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return "justo ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// The admin "Ayuda" tab — a support inbox for chats a client escalated with
// "Hablar con una persona" (see help-chat.tsx on the client side). Staff
// reply directly here; the reply shows up in the client's chat via its own
// polling, no separate channel or redirect to email.
export function AdminHelpPanel({
  conversations,
  onSent,
}: {
  conversations: HelpConversationListItem[];
  onSent: (text: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["admin-help-conversation", selectedId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/help-conversation?conversationId=${encodeURIComponent(selectedId ?? "")}`,
        { credentials: "include" },
      );
      if (!res.ok) return null;
      return (await res.json()) as { ok: boolean } & ConversationDetail;
    },
    enabled: Boolean(selectedId),
    refetchInterval: 8000,
  });

  async function act(action: "reply" | "resolve") {
    if (!selectedId || sending) return;
    if (action === "reply" && !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/help-conversation", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "reply"
            ? { conversationId: selectedId, action: "reply", content: reply.trim() }
            : { conversationId: selectedId, action: "resolve" },
        ),
      });
      const body = (await res.json()) as { ok: boolean };
      if (body.ok) {
        if (action === "reply") setReply("");
        await queryClient.invalidateQueries({ queryKey: ["admin-help-conversation", selectedId] });
        await queryClient.invalidateQueries({ queryKey: ["admin-help-conversations"] });
        if (action === "resolve") {
          onSent("Conversación marcada como resuelta");
          setSelectedId(null);
        } else {
          onSent("Respuesta enviada");
        }
      }
    } finally {
      setSending(false);
    }
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[340px_1fr]">
      <div className={`space-y-2.5 ${selectedId ? "hidden lg:block" : ""}`}>
        {conversations.length === 0 ? (
          <div className="wit-glass rounded-2xl px-4 py-8 text-center text-sm text-wit-gray">
            No hay conversaciones de ayuda abiertas.
          </div>
        ) : (
          conversations.map((c) => {
            const meta = STATUS_META[c.status];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`block w-full rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                  selectedId === c.id
                    ? "border-wit-blue bg-wit-blue/5"
                    : "border-wit-ink/10 bg-white hover:border-wit-blue/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-wit-ink">{c.client_name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}
                  >
                    {meta.label}
                  </span>
                </div>
                {c.company_name ? (
                  <p className="mt-0.5 text-xs text-wit-gray">{c.company_name}</p>
                ) : null}
                {c.last_message ? (
                  <p className="mt-1.5 truncate text-xs text-wit-gray">{c.last_message}</p>
                ) : null}
                <p className="mt-1.5 text-[11px] font-medium text-wit-gray/70">
                  {timeAgo(c.updated_at)}
                </p>
              </button>
            );
          })
        )}
      </div>

      <div className={`${selectedId ? "" : "hidden lg:flex"} flex flex-col`}>
        {!selected ? (
          <div className="wit-glass flex h-full min-h-[300px] flex-col items-center justify-center gap-2 rounded-2xl text-center text-sm text-wit-gray">
            <MessageCircleQuestion size={28} strokeWidth={1.6} />
            Selecciona una conversación para ver el detalle.
          </div>
        ) : (
          <div className="flex h-full flex-col rounded-2xl border border-wit-ink/10 bg-white">
            <div className="flex items-center gap-2 border-b border-wit-ink/10 px-5 py-4">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-wit-gray hover:bg-wit-mist/60 lg:hidden"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-wit-ink">{selected.client_name}</p>
                <p className="truncate text-xs text-wit-gray">
                  {selected.client_email}
                  {selected.company_name ? ` · ${selected.company_name}` : ""}
                </p>
              </div>
              {selected.status !== "resuelta" ? (
                <button
                  type="button"
                  onClick={() => void act("resolve")}
                  disabled={sending}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  Marcar resuelta
                </button>
              ) : null}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {detailQuery.isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-wit-blue/30 border-t-wit-blue" />
                </div>
              ) : (
                detailQuery.data?.messages.map((m) => {
                  const isStaff = m.role === "staff";
                  const isClient = m.role === "user";
                  return (
                    <div
                      key={m.id}
                      className={`flex items-end gap-2 ${isStaff ? "flex-row-reverse self-end" : "self-start"}`}
                    >
                      {!isStaff ? (
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                            isClient ? "bg-wit-mist text-wit-gray" : "bg-wit-blue/10 text-wit-blue"
                          }`}
                        >
                          <UserRound size={13} />
                        </span>
                      ) : null}
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          isStaff
                            ? "rounded-br-sm bg-wit-blue text-white"
                            : isClient
                              ? "rounded-bl-sm bg-wit-mist/60 text-wit-ink"
                              : "rounded-bl-sm bg-wit-ice text-wit-ink"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selected.status !== "resuelta" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("reply");
                }}
                className="flex items-center gap-2 border-t border-wit-ink/10 px-4 py-3"
              >
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Responder al cliente..."
                  className="flex-1 rounded-full border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
                />
                <button
                  type="submit"
                  disabled={!reply.trim() || sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wit-blue text-white transition hover:bg-wit-blue-deep disabled:opacity-40"
                  aria-label="Enviar"
                >
                  <Send size={16} />
                </button>
              </form>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
