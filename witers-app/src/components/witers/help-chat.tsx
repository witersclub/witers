import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleQuestion, Send, UserRound, X } from "lucide-react";

import { useLanguage } from "../../lib/i18n";
import { WMark } from "./brand";

type HelpConversationStatus = "ia" | "escalada" | "resuelta";

type HelpConversation = {
  id: string;
  status: HelpConversationStatus;
};

type HelpMessage = {
  id: string;
  role: "user" | "assistant" | "staff";
  content: string;
  created_at: string;
};

type HelpChatState = { conversation: HelpConversation | null; messages: HelpMessage[] };

async function fetchHelpChat(): Promise<HelpChatState> {
  const res = await fetch("/api/help-chat", { credentials: "include" });
  if (!res.ok) return { conversation: null, messages: [] };
  const body = (await res.json()) as {
    ok: boolean;
    conversation: HelpConversation | null;
    messages: HelpMessage[];
  };
  return { conversation: body.conversation ?? null, messages: body.messages ?? [] };
}

// The blue chat-bubble button next to LanguageToggle in panel.tsx's header —
// filled brand-blue background + white icon on purpose, a more prominent
// treatment than LanguageToggle's neutral bordered style, since this is the
// one thing in the header that starts a conversation rather than a setting.
export function HelpChatButton() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Ayuda", "Help")}
        title={t("Ayuda", "Help")}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-wit-blue text-white shadow-sm transition hover:bg-wit-blue-deep"
      >
        <MessageCircleQuestion size={18} strokeWidth={2.2} />
      </button>
      {open ? <HelpChatModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function HelpMessageBubble({ message }: { message: HelpMessage }) {
  const isUser = message.role === "user";
  const isStaff = message.role === "staff";
  return (
    <div className={`flex items-end gap-2 ${isUser ? "flex-row-reverse self-end" : "self-start"}`}>
      {!isUser ? (
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            isStaff ? "bg-emerald-100 text-emerald-700" : "bg-wit-blue/10 text-wit-blue"
          }`}
        >
          {isStaff ? <UserRound size={13} /> : <WMark size={13} />}
        </span>
      ) : null}
      <div
        className={`max-w-[240px] rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm bg-wit-blue text-white"
            : isStaff
              ? "rounded-bl-sm bg-emerald-50 text-wit-ink"
              : "wit-glass rounded-bl-sm text-wit-ink"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

function HelpChatModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const chatQuery = useQuery({
    queryKey: ["help-chat"],
    queryFn: fetchHelpChat,
    // Once escalated, a real person may reply any time — poll so it shows
    // up without the client having to close and reopen the chat. Not
    // needed for the AI, whose reply always arrives in the send response.
    refetchInterval: (query) =>
      query.state.data?.conversation?.status === "escalada" ? 4000 : false,
  });
  const data = chatQuery.data;
  const status = data?.conversation?.status ?? null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages.length, sending]);

  async function sendMessage() {
    const text = content.trim();
    if (!text || sending) return;
    setContent("");
    setSending(true);
    try {
      const res = await fetch("/api/help-chat", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "message", content: text }),
      });
      const body = (await res.json()) as HelpChatState & { ok: boolean };
      if (body.ok) {
        queryClient.setQueryData(["help-chat"], {
          conversation: body.conversation,
          messages: body.messages,
        });
      }
    } finally {
      setSending(false);
    }
  }

  async function escalate() {
    if (escalating) return;
    setEscalating(true);
    try {
      const res = await fetch("/api/help-chat", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "escalate" }),
      });
      const body = (await res.json()) as HelpChatState & { ok: boolean };
      if (body.ok) {
        queryClient.setQueryData(["help-chat"], {
          conversation: body.conversation,
          messages: body.messages,
        });
      }
    } finally {
      setEscalating(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-wit-navy/50 p-0 sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[85svh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-[75vh] sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-wit-ink/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-wit-blue text-white">
              <MessageCircleQuestion size={16} strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-sm font-bold text-wit-ink">{t("Ayuda WITERS", "WITERS Help")}</p>
              <p className="text-[11px] text-wit-gray">
                {status === "escalada"
                  ? t("Un miembro del equipo te atenderá aquí", "A team member will help you here")
                  : t("Pregunta lo que necesites", "Ask anything you need")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-wit-gray hover:bg-wit-mist/60 hover:text-wit-ink"
            aria-label={t("Cerrar", "Close")}
          >
            <X size={18} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {chatQuery.isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-wit-blue/30 border-t-wit-blue" />
            </div>
          ) : !data?.messages.length ? (
            <HelpMessageBubble
              message={{
                id: "welcome",
                role: "assistant",
                content: t(
                  "Hola, soy el asistente de ayuda de WITERS. Pregúntame sobre tu plan, tus solicitudes o cómo funciona el servicio.",
                  "Hi, I'm the WITERS help assistant. Ask me about your plan, your requests, or how the service works.",
                ),
                created_at: "",
              }}
            />
          ) : (
            data.messages.map((m) => <HelpMessageBubble key={m.id} message={m} />)
          )}
          {sending ? (
            <div className="flex items-end gap-2 self-start">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wit-blue/10 text-wit-blue">
                <WMark size={13} />
              </span>
              <div className="wit-glass flex items-center gap-1 rounded-2xl rounded-bl-sm px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wit-gray [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wit-gray [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wit-gray" />
              </div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-wit-ink/10 px-4 py-3">
          {status !== "escalada" && status !== "resuelta" ? (
            <button
              type="button"
              onClick={escalate}
              disabled={escalating}
              className="mb-2.5 w-full rounded-full border border-wit-blue/30 py-2 text-xs font-bold text-wit-blue transition hover:bg-wit-blue/5 disabled:opacity-50"
            >
              {escalating
                ? t("Conectando...", "Connecting...")
                : t("Hablar con una persona", "Talk to a person")}
            </button>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("Escribe tu pregunta...", "Type your question...")}
              className="flex-1 rounded-full border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
            />
            <button
              type="submit"
              disabled={!content.trim() || sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wit-blue text-white transition hover:bg-wit-blue-deep disabled:opacity-40"
              aria-label={t("Enviar", "Send")}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
