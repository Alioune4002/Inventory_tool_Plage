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

  // Entitlements (needed for icon mode label)
  const entLoaded = entitlements !== null;
  const aiAllowed = entitlements?.entitlements?.ai_assistant_basic === true;
  const planEffective = entitlements?.plan_effective;
  const aiModeLabel = planEffective === "BOUTIQUE" ? "IA light" : planEffective === "PRO" ? "IA coach" : null;
  const aiMode = planEffective === "BOUTIQUE" ? "light" : "coach";
  const canUseAI = !entLoaded || aiAllowed;

  // Floating button UX
  const [fabMode, setFabMode] = useState("full"); // "full" | "icon"
  const [justOpened, setJustOpened] = useState(false);
  const fabTimerRef = useRef(null);

  function vibrate(pattern) {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern);
    } catch {
      // noop
    }
  }

  const startFabTimer = useCallback(() => {
    if (fabTimerRef.current) window.clearTimeout(fabTimerRef.current);
    fabTimerRef.current = window.setTimeout(() => {
      setFabMode((prev) => (open ? prev : "icon"));
    }, 10000);
  }, [open]);

  // Reset FAB on route changes (in /app)
  const visibleInApp = isAppPath(location.pathname);

  useEffect(() => {
    if (!visibleInApp) return;

    setFabMode("full");
    startFabTimer();

    return () => {
      if (fabTimerRef.current) window.clearTimeout(fabTimerRef.current);
    };
  }, [visibleInApp, location.pathname, startFabTimer]);

  // If drawer opens, keep full; if it closes, restart timer
  useEffect(() => {
    if (!visibleInApp) return;

    if (open) {
      setFabMode("full");
      if (fabTimerRef.current) window.clearTimeout(fabTimerRef.current);
    } else {
      startFabTimer();
    }
  }, [open, startFabTimer, visibleInApp]);

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

  const currentService = useMemo(() => {
    const sid = ctx?.serviceId;
    if (!services?.length) return null;
    if (!sid || sid === "all") return null;
    return services.find((s) => String(s.id) === String(sid)) || null;
  }, [ctx?.serviceId, services]);

  const scopeLabel = ctx.scope === "support" ? "Support" : "Inventaire";
  const suggestions = ctx.scope === "support" ? SUPPORT_SUGGESTIONS : DEFAULT_SUGGESTIONS;

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

      // micro animation + haptique
      setJustOpened(true);
      vibrate([10, 20, 10]);
      window.setTimeout(() => setJustOpened(false), 220);

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
    // 1er clic si réduit => on repasse en “full” (sans ouvrir)
    if (fabMode === "icon") {
      setFabMode("full");
      vibrate(10);
      startFabTimer();
      return;
    }

    // scope auto selon page
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

      // message user optimistic
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

  // ------- UI -------
  if (!visibleInApp) return null;

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={openFromButton}
        className={[
          "fixed bottom-5 right-5 z-[70] border border-white/10 bg-[var(--surface)] shadow-[0_20px_50px_rgba(0,0,0,0.35)] hover:opacity-95",
          "transition-all duration-200",
          fabMode === "icon" ? "h-12 w-12 rounded-full p-0" : "rounded-full px-4 py-3",
          open ? "ring-1 ring-blue-500/30" : "",
          justOpened ? "scale-[1.02]" : "",
        ].join(" ")}
        aria-label="Ouvrir l’assistant IA"
        title="Assistant IA"
      >
        {fabMode === "icon" ? (
          <div className="h-12 w-12 flex items-center justify-center relative">
            {/* halo discret si open */}
            {open ? <span className="absolute inset-0 rounded-full bg-blue-500/10 blur-[6px]" /> : null}

            {/* Robot icon (diff selon mode) */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="relative text-[var(--text)]"
            >
              {/* antenna */}
              <path d="M12 2.8v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="12" cy="2.4" r="1" fill="currentColor" className={open ? "animate-pulse" : ""} />

              {/* head */}
              <rect x="4" y="6" width="16" height="12" rx="4" stroke="currentColor" strokeWidth="1.6" />

              {/* eyes */}
              <circle cx="9" cy="12" r="1.2" fill="currentColor" />
              <circle cx="15" cy="12" r="1.2" fill="currentColor" />

              {/* mouth */}
              <path d="M9 15h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />

              {/* coach spark (si mode coach) */}
              {aiMode !== "light" ? (
                <path
                  d="M19 6.2l.6 1.3 1.4.2-1 .9.3 1.4-1.3-.7-1.3.7.3-1.4-1-.9 1.4-.2.6-1.3z"
                  fill="currentColor"
                  opacity="0.9"
                />
              ) : null}
            </svg>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className={["inline-flex h-2.5 w-2.5 rounded-full bg-blue-500", open ? "animate-pulse" : ""].join(" ")} />
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

          {/* panel (100dvh + safe-area) */}
          <div className="absolute right-0 top-0 h-[100dvh] w-full max-w-[460px]">
            <Card
              className={[
                "h-full rounded-none sm:rounded-l-[28px] border-l border-[var(--border)] bg-[var(--surface)] p-0 overflow-hidden flex flex-col",
                "transition-transform duration-200",
                justOpened ? "scale-[1.005]" : "",
              ].join(" ")}
            >
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

              {/* content wrapper: min-h-0 important pour le scroll */}
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

                {/* messages */}
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

                {/* footer input (safe-area bottom) */}
                <div className="border-t border-[var(--border)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
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
                          onClick={() => send(input)}
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