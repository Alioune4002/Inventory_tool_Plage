import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ChefHat, ClipboardList, Bell } from "lucide-react";

import PublicShell from "../../components/public/PublicShell";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import { useAuth } from "../../app/AuthProvider";
import { getKdsUiCopy } from "../../lib/uiCopyByActivityType";
import kdsLogo from "../../assets/kds-logo.png";

const KdsLogo = () => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="h-12 w-12 rounded-2xl bg-white/10 text-white flex items-center justify-center font-black">
        KDS
      </div>
    );
  }
  return (
    <img
      src={kdsLogo}
      alt="StockScan KDS"
      className="h-12 w-12 rounded-2xl object-cover"
      onError={() => setFailed(true)}
    />
  );
};

export default function KdsLanding() {
  const { isAuthed, serviceProfile } = useAuth();
  const serviceType = serviceProfile?.service_type;
  const copy = useMemo(() => getKdsUiCopy(serviceType), [serviceType]);

  const next = encodeURIComponent("/kds/app");
  const primaryHref = isAuthed ? "/kds/app" : `/login?next=${next}`;
  const secondaryHref = isAuthed ? "/kds/app" : `/register?next=${next}`;

  return (
    <PublicShell>
      <Helmet>
        <title>KDS | StockScan</title>
        <meta
          name="description"
          content="Écran cuisine StockScan : commandes en temps réel, statuts clairs, service fluide."
        />
        <link rel="canonical" href="https://stockscan.app/kds" />
      </Helmet>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 space-y-10 text-white">
        <section className="grid lg:grid-cols-[1.3fr_1fr] gap-8 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <KdsLogo />
              <div className="text-sm font-semibold text-white/70">StockScan KDS</div>
            </div>
            <h1 className="text-3xl md:text-4xl font-black">{copy.title}</h1>
            <p className="text-lg text-slate-200">{copy.subtitle}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button as={Link} to={primaryHref} size="lg">
                Ouvrir le KDS
              </Button>
              <Button as={Link} to={secondaryHref} variant="secondary" size="lg">
                Créer un compte gratuit
              </Button>
            </div>
            <p className="text-sm text-slate-300">
              Le KDS fonctionne seul, et vous activez StockScan complet quand vous êtes prêt.
            </p>
          </div>

          <Card className="p-6 space-y-4">
            <div className="text-sm font-semibold text-white/70">Pourquoi vos équipes l’adorent</div>
            <div className="space-y-3 text-sm text-slate-200">
              <div className="flex items-start gap-3">
                <ClipboardList className="h-5 w-5 text-blue-300" />
                <span>Commandes centralisées et lisibles sur tablette cuisine.</span>
              </div>
              <div className="flex items-start gap-3">
                <ChefHat className="h-5 w-5 text-blue-300" />
                <span>Statuts clairs pour éviter les oublis et fluidifier le service.</span>
              </div>
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-blue-300" />
                <span>Priorisez, préparez, servez sans perdre le fil.</span>
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
