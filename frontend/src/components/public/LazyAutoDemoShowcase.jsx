import React, { Suspense, useEffect, useRef, useState } from "react";

const AutoDemoShowcase = React.lazy(() => import("../../demo/AutoDemoShowcase"));

const fallback = (
  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
    <div className="text-sm uppercase tracking-[0.3em] text-white/50">Démo</div>
    <div className="mt-2 text-lg font-semibold text-white">Chargement de l’aperçu…</div>
    <div className="mt-3 text-sm text-white/60">Un aperçu léger et réaliste arrive dans un instant.</div>
  </div>
);

export default function LazyAutoDemoShowcase() {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ref.current || ready) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div ref={ref}>
      {ready ? <Suspense fallback={fallback}><AutoDemoShowcase /></Suspense> : fallback}
    </div>
  );
}
