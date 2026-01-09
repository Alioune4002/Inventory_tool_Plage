import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ReceiptText, CreditCard, BarChart3 } from "lucide-react";

import PublicShell from "../../components/public/PublicShell";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import { useAuth } from "../../app/AuthProvider";
import { getPosUiCopy } from "../../lib/uiCopyByActivityType";
import posLogo from "../../assets/pos-logo.png";

const PosLogo = () => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="h-12 w-12 rounded-2xl bg-white/10 text-white flex items-center justify-center font-black">
        POS
      </div>
    );
  }
  return (
    <img
      src={posLogo}
      alt="StockScan POS"
      className="h-12 w-12 rounded-2xl object-cover"
      onError={() => setFailed(true)}
    />
  );
};

export default function PosLanding() {
  const { isAuthed, serviceProfile } = useAuth();
  const serviceType = serviceProfile?.service_type;

  const copy = useMemo(() => getPosUiCopy(serviceType), [serviceType]);
  const next = encodeURIComponent("/pos/app");

  const primaryHref = isAuthed ? "/pos/app" : `/login?next=${next}`;
  const secondaryHref = isAuthed ? "/pos/app" : `/register?next=${next}`;

  return (
    <PublicShell>
      <Helmet>
        <title>POS | StockScan</title>
        <meta
          name="description"
          content="Encaissez, suivez vos ventes et exportez vos rapports avec StockScan POS."
        />
        <link rel="canonical" href="https://stockscan.app/pos" />
      </Helmet>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 space-y-10 text-white">
        <section className="grid lg:grid-cols-[1.3fr_1fr] gap-8 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <PosLogo />
              <div className="text-sm font-semibold text-white/70">StockScan POS</div>
            </div>
            <h1 className="text-3xl md:text-4xl font-black">{copy.title}</h1>
            <p className="text-lg text-slate-200">{copy.subtitle}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button as={Link} to={primaryHref} size="lg">
                Ouvrir le POS
              </Button>
              <Button as={Link} to={secondaryHref} variant="secondary" size="lg">
                Créer un compte gratuit
              </Button>
            </div>
            <p className="text-sm text-slate-300">
              Activez StockScan (gestion stock avancée) quand vous voulez, sans réinstaller quoi que ce soit.
            </p>
          </div>

          <Card className="p-6 space-y-4">
            <div className="text-sm font-semibold text-white/70">Ce que vous gagnez</div>
            <div className="space-y-3 text-sm text-slate-200">
              <div className="flex items-start gap-3">
                <ReceiptText className="h-5 w-5 text-blue-300" />
                <span>Tickets clairs, remises simples, encaissement rapide.</span>
              </div>
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-blue-300" />
                <span>Multi‑paiements : espèces, carte, chèque, ticket restaurant.</span>
              </div>
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-blue-300" />
                <span>Rapports de ventes lisibles, exportables en un clic.</span>
              </div>
            </div>
          </Card>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          {copy.highlights.map((item) => (
            <Card key={item} className="p-5 space-y-2">
              <div className="text-sm font-semibold text-white">Point fort</div>
              <p className="text-sm text-slate-200">{item}</p>
            </Card>
          ))}
        </section>
      </main>
    </PublicShell>
  );
}
