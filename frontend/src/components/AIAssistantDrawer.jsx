import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { api } from "../lib/api";
import { useToast } from "../app/ToastContext";
import useEntitlements from "../app/useEntitlements";
import { useAuth } from "../app/AuthProvider";

/**
 * Global drawer + floating button.
 * Ouverture possible via:
 * window.dispatchEvent(new CustomEvent("stockscan:ai:open", { detail: { month, serviceId, scope } }))
 */
const DEFAULT_SUGGESTIONS = [
  "Peux-tu me résumer mon stock ce mois-ci ?",
  "Où sont mes pertes les plus importantes ?",
  "Quels produits risquent d’être en rupture ?",
  "Quelles données manquent pour fiabiliser mes analyses ?",
  "Qu’est-ce que je dois prioriser maintenant ?",
];

const SUPPORT_SUGGESTIONS = [
  "Pourquoi j’ai une erreur 403 sur un export ?",
  "Comment exporter en Excel ?",
  "Le scan code-barres ne marche pas, que faire ?",
  "Où activer les options (prix, lots, dates) ?",
];

function nowMonth() {
  return new Date().toISOString().slice(0, 7);
}

function isAppPath(pathname) {
  const p = String(pathname || "");
  return p.startsWith("/app");
}

export default function AIAssistantDrawer() {
  const pushToast = useToast();
  const { data: entitlements } = useEntitlements();
  const { services, serviceId: authServiceId } = useAuth();
  const location = useLocation();

  // Drawer state
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState({
    month: nowMonth(),
    serviceId: authServiceId || "all",
    scope: "inventory",
  });

  // Floating button state: "pill" (grand) -> "icon" (réduit)
  const [fabMode, setFabMode] = useState("pill");
  const fabTimerRef = useRef(null);

  // Chat state
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Bonjour. Posez-moi une question comme à un chat. Je peux analyser votre stock, vos pertes, vos priorités, ou vous guider sur l’app.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const scrollRef = useRef(null);

  const entLoaded = entitlements !== null;
  const aiAllowed = entitlements?.entitlements?.ai_assistant_basic === true;
  const planEffective = entitlements?.plan_effective;
  const aiModeLabel = planEffective === "BOUTIQUE" ? "IA light" : planEffective === "PRO" ? "IA coach" : null;

  const canUseAI = !entLoaded || aiAllowed;

  const currentService = useMemo(() => {
    const sid = ctx?.serviceId;
    if (!services?.length) return null;
    if (!sid || sid === "all") return null;
    return services.find((s) => String(s.id) === String(sid)) || null;
  }, [ctx?.serviceId, services]);

  const scopeLabel = ctx.scope === "support" ? "Support" : "Inventaire";
  const suggestions = ctx.scope === "support" ? SUPPORT_SUGGESTIONS : DEFAULT_SUGGESTIONS;

  const visibleInApp = isAppPath(location.pathname);

  // --- FAB auto-shrink après 10s (si drawer fermé) ---
  const startFabTimer = useCallback(() => {
    if (fabTimerRef.current) window.clearTimeout(fabTimerRef.current);
    fabTimerRef.current = window.setTimeout(() => {
      // on shrink seulement si le drawer n'est pas ouvert
      setFabMode((prev) => (open ? prev : "icon"));
    }, 10000);
  }, [open]);

  useEffect(() => {
    if (!visibleInApp) return;
    // à l'arrivée sur une page /app : on montre le pill puis shrink après 10s
    setFabMode("pill");
    startFabTimer();
    return () => {
      if (fabTimerRef.current) window.clearTimeout(fabTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, visibleInApp]);

  useEffect(() => {
    // quand on ouvre le drawer, on repasse pill (et pas de shrink pendant l'ouverture)
    if (open) {
      setFabMode("pill");
      if (fabTimerRef.current) window.clearTimeout(fabTimerRef.current);
    } else if (visibleInApp) {
      // drawer fermé: relance le timer
      startFabTimer();
    }
  }, [open, startFabTimer, visibleInApp]);

  // Auto-scroll
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 50);
    return () => window.clearTimeout(t);
  }, [messages.length, open]);

  // Open via event
  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail || {};
      const next = {
        month: detail.month || detail.period_start || detail.period || nowMonth(),
        serviceId: detail.serviceId ?? detail.service ?? authServiceId ?? "all",
        scope: detail.scope || "inventory",
      };
      setCtx(next);
      setOpen(true);

      // new context => new thread by default (évite les “mélanges”)
      if (detail.resetThread !== false) {
        setConversationId(null);
        setMessages([
          {
            role: "assistant",
            content:
              next.scope === "support"
                ? "D’accord. Décrivez le problème (page + action + message d’erreur) et je vous guide étape par étape."
                : "D’accord. Posez votre question : je réponds à partir de vos données et je propose une marche à suivre.",
          },
        ]);
      }
    };

    window.addEventListener("stockscan:ai:open", handler);
    return () => window.removeEventListener("stockscan:ai:open", handler);
  }, [authServiceId]);

  const openFromButton = () => {
    const scope = location.pathname.startsWith("/app/support") ? "support" : "inventory";
    window.dispatchEvent(
      new CustomEvent("stockscan:ai:open", {
        detail: { month: ctx?.month || nowMonth(), serviceId: authServiceId || "all", scope, resetThread: false },
      })
    );
  };

  const closeDrawer = () => setOpen(false);

  const send = useCallback(
    async (text) => {
      const trimmed = String(text || "").trim();
      if (!trimmed) return;

      if (!canUseAI) {
        setNotice("Cette fonctionnalité est disponible avec les plans Duo ou Multi.");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Plan Duo ou Multi requis. Vous pouvez voir les offres depuis /tarifs." },
        ]);
        return;
      }

      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setInput("");
      setNotice("");
      setSending(true);

      try {
        const resp = await api.post("/api/ai/chat/", {
          conversation_id: conversationId || undefined,
          scope: ctx.scope,
          month: ctx.month,
          service: ctx.serviceId || "all",
          message: trimmed,
        });

        const payload = resp?.data || {};

        if (payload?.enabled === false) {
          setNotice(payload?.message || "Cette fonctionnalité nécessite un plan supérieur.");
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                payload?.message ||
                "Cette fonctionnalité nécessite un plan supérieur. Vous pouvez consulter les offres.",
            },
          ]);
          return;
        }

        if (payload?.conversation_id) setConversationId(payload.conversation_id);

        const reply = payload?.reply || "Je n’ai pas réussi à formuler une réponse. Pouvez-vous reformuler ?";
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } catch (e) {
        const msg =
          e?.friendlyMessage ||
          e?.response?.data?.detail ||
          "L’assistant n’est pas disponible pour le moment. Réessayez dans quelques secondes.";
        setNotice(msg);
        pushToast?.({ message: "Assistant IA indisponible.", type: "error" });
        setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
      } finally {
        setSending(false);
      }
    },
    [canUseAI, conversationId, ctx.month, ctx.scope, ctx.serviceId, pushToast]
  );

  const handleSend = () => send(input);

  const headerServiceLabel = useMemo(() => {
    if (!ctx.serviceId || ctx.serviceId === "all") return "Tous les services";
    return currentService?.name || `Service #${ctx.serviceId}`;
  }, [ctx.serviceId, currentService]);

  
  if (!visibleInApp) return null;

  const onFabClick = () => {
    
    if (fabMode === "icon") {
      setFabMode("pill");
      startFabTimer();
      return;
    }
   
    openFromButton();
  };

  return (
    <>
      {/* Floating button (auto shrink + safe-area) */}
      <button
        type="button"
        onClick={onFabClick}
        className={[
          "fixed right-5 z-[70] border border-white/10 bg-[var(--surface)] shadow-[0_20px_50px_rgba(0,0,0,0.35)] hover:opacity-95",
          // safe-area bottom iOS
          "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]",
          // transition smooth
          "transition-all duration-200",
          fabMode === "icon" ? "rounded-full p-3" : "rounded-full px-4 py-3",
        ].join(" ")}
        aria-label="Assistant IA"
        title="Assistant IA"
      >
         {fabMode === "icon" ? (
  <div className="flex items-center justify-center">
    {/* AI icon (sparkles + chat bubble) */}
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="text-[var(--text)]"
    >
      {/* chat bubble */}
      <path
        d="M7.5 18.2 4.6 19.4c-.4.16-.8-.2-.66-.6l1.02-3.1A7.9 7.9 0 0 1 4 12c0-4.1 3.6-7.5 8-7.5s8 3.4 8 7.5-3.6 7.5-8 7.5c-1.3 0-2.6-.3-3.7-.8-.27-.12-.58-.13-.86-.02Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* sparkles */}
      <path
        d="M16.2 7.2l.45 1.1c.08.2.24.36.44.44l1.1.45-1.1.45c-.2.08-.36.24-.44.44l-.45 1.1-.45-1.1a.8.8 0 0 0-.44-.44l-1.1-.45 1.1-.45c.2-.08.36-.24.44-.44l.45-1.1Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M18.6 11.6l.25.62c.06.14.17.25.31.31l.62.25-.62.25a.56.56 0 0 0-.31.31l-.25.62-.25-.62a.56.56 0 0 0-.31-.31l-.62-.25.62-.25c.14-.06.25-.17.31-.31l.25-.62Z"
        fill="currentColor"
        opacity="0.75"
      />
    </svg>
  </div>
) : (
  <>
    <div className="flex items-center gap-2">
      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
      <span className="text-sm font-semibold text-[var(--text)]">Assistant IA</span>
    </div>
    <div className="text-[11px] text-[var(--muted)] -mt-0.5">Chat & support</div>
  </>
)}
      </button>

      {/* Drawer */}
      {open ? (
        <div className="fixed inset-0 z-[80]">
          {/* overlay */}
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Fermer" onClick={closeDrawer} />

          {/* panel (fix mobile height + prevent bottom overflow) */}
          <div className="absolute right-0 top-0 h-[100dvh] w-full max-w-[460px]">
            <Card className="h-full rounded-none sm:rounded-l-[28px] border-l border-[var(--border)] bg-[var(--surface)] p-0 overflow-hidden flex flex-col">
              {/* header */}
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Assistant IA</div>
                  <div className="text-lg font-black text-[var(--text)] leading-tight">Chat</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5 truncate">
                    {scopeLabel} · {headerServiceLabel} · {ctx.month || nowMonth()}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {aiModeLabel && aiAllowed ? (
                    <Badge className="bg-[var(--info-bg)] text-[var(--info-text)] border border-[var(--info-border)]">
                      {aiModeLabel}
                    </Badge>
                  ) : null}

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setConversationId(null);
                      setMessages([
                        {
                          role: "assistant",
                          content:
                            ctx.scope === "support"
                              ? "Nouveau fil support. Décrivez le problème (page + action + message d’erreur)."
                              : "Nouveau fil. Posez votre question, je réponds à partir de vos données.",
                        },
                      ]);
                    }}
                  >
                    Nouveau
                  </Button>

                  <Button size="sm" variant="ghost" onClick={closeDrawer}>
                    Fermer
                  </Button>
                </div>
              </div>

              {/* content wrapper: IMPORTANT min-h-0 to allow scroll */}
              <div className="flex-1 min-h-0 flex flex-col">
                {/* quick suggestions */}
                <div className="p-4 border-b border-[var(--border)]">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Suggestions</div>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.slice(0, 4).map((s) => (
                      <Button key={s} size="sm" variant="secondary" onClick={() => send(s)} disabled={sending}>
                        {s}
                      </Button>
                    ))}
                  </div>

                  {!aiAllowed && entLoaded ? (
                    <div className="mt-3 rounded-2xl border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn-text)]">
                      Disponible avec les plans Duo ou Multi.{" "}
                      <Link className="underline font-semibold" to="/tarifs">
                        Voir les offres
                      </Link>
                      .
                    </div>
                  ) : null}
                </div>

                {/* messages (scroll) */}
                <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
                  {messages.map((m, idx) => {
                    const isUser = m.role === "user";
                    return (
                      <div key={idx} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                        <div
                          className={[
                            "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed border",
                            isUser
                              ? "bg-blue-600 text-white border-blue-500/40"
                              : "bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]",
                          ].join(" ")}
                        >
                          {m.content}
                        </div>
                      </div>
                    );
                  })}

                  {sending ? (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm border bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]">
                        Réflexion en cours…
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* footer input (safe-area bottom, always visible/clickable) */}
                <div
                  className="border-t border-[var(--border)] space-y-2"
                  style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
                >
                  <div className="p-4 space-y-2">
                    {notice ? (
                      <div className="rounded-2xl border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-3 text-sm text-[var(--info-text)]">
                        {notice}
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                      <textarea
                        rows={2}
                        className="w-full resize-none bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                        placeholder={
                          ctx.scope === "support"
                            ? "Expliquez le problème (page + action + message d’erreur)"
                            : "Posez une question précise (ex : quels produits sont à risque ?)"
                        }
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={sending || (entLoaded && !aiAllowed)}
                      />
                      <div className="flex items-center justify-between pt-2 text-xs text-[var(--muted)] gap-3">
                        <span className="truncate">
                          {ctx.scope === "support"
                            ? "Guidage sur l’app + résolution de blocages."
                            : "Réponses basées sur vos données (service/mois)."}
                        </span>
                        <Button
                          size="sm"
                          onClick={handleSend}
                          loading={sending}
                          disabled={sending || !input.trim() || (entLoaded && !aiAllowed)}
                        >
                          Envoyer
                        </Button>
                      </div>
                    </div>

                    <div className="text-[11px] text-[var(--muted)]">
                      Astuce : si vous voulez une réponse “actionnable”, terminez par “donne-moi les 3 priorités”.
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}