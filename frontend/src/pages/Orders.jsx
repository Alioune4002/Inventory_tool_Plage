import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

/**
 * Orders est désormais intégré au HUB KDS (/kds).
 * On garde ce fichier uniquement pour compat route/backward-compat :
 * - /orders/app ou /orders => redirige vers /kds/app (onglet Salle)
 */
export default function Orders() {
  const navigate = useNavigate();

  useEffect(() => {
    // Si tu veux passer un "tab" via query plus tard, tu pourras le lire ici.
    // Pour l'instant on redirige simplement vers le hub.
    navigate("/kds/app?tab=orders", { replace: true });
  }, [navigate]);

  return (
    <>
      <Helmet>
        <title>Commandes | StockScan</title>
        <meta
          name="description"
          content="Prise de commande (Salle) intégrée au hub StockScan KDS."
        />
      </Helmet>
      {/* Optionnel: écran très léger si jamais la navigation est lente */}
      <div className="p-6 text-sm text-[var(--muted)]">Redirection vers le hub KDS…</div>
    </>
  );
}