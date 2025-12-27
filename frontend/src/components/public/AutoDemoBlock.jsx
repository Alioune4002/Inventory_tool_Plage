import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const presets = {
  restaurant: {
    service: "Cuisine",
    item: "Tagliatelles fraîches",
    steps: [
      { title: "Scan produit", text: "Lecture code-barres ou SKU interne, fiche préremplie." },
      { title: "Ajouter sans code-barres", text: "Création rapide avec SKU généré automatiquement." },
      { title: "Changer de service", text: "Passez d’un bar à une cuisine ou boutique en un clic." },
      { title: "Déclarer une perte", text: "Casse / DLC / invendu : impact visible dans les stats." },
      { title: "Exporter", text: "Générez un CSV/XLSX (partage e-mail en plan Multi)." },
    ],
  },
  bar: {
    service: "Bar",
    item: "Bouteille de gin",
    steps: [
      { title: "Reste bouteille", text: "Indiquez le dixième ou le ml restant." },
      { title: "Perte bar", text: "Offerts / casse / évaporation enregistrés." },
      { title: "Changer de service", text: "Passez du bar à l’épicerie ou la boutique." },
      { title: "Exporter bar", text: "Export volume + pièces pour la direction." },
    ],
  },
  boulangerie: {
    service: "Boulangerie",
    item: "Baguettes tradition",
    steps: [
      { title: "Production du jour", text: "Ajoutez les produits finis du jour." },
      { title: "Invendus", text: "Déclarez les invendus fin de journée." },
      { title: "Matières premières", text: "Suivez farine / beurre / œufs." },
      { title: "Exporter inventaire", text: "CSV/XLSX pour la comptabilité ou l’équipe." },
    ],
  },
  epicerie: {
    service: "Épicerie",
    item: "Coca 33cl",
    steps: [
      { title: "Scan code-barres", text: "EAN prioritaire, préremplissage auto." },
      { title: "SKU interne", text: "Générez un SKU pour les produits locaux sans EAN." },
      { title: "DLC/DDM", text: "Ajoutez la date quand c’est pertinent." },
      { title: "Exporter mensuel", text: "Export par mois/service pour la compta." },
    ],
  },
  boutique: {
    service: "Boutique",
    item: "T-shirt bleu (M)",
    steps: [
      { title: "SKU + variante", text: "Saisissez taille/couleur, code-barres facultatif." },
      { title: "Articles sans DLC", text: "Champs alimentaires masqués automatiquement." },
      { title: "Changer de service", text: "Passez à la boutique souvenirs ou accessoires." },
      { title: "Export retail", text: "CSV/XLSX épuré pour la comptabilité." },
    ],
  },
  pharmacie: {
    service: "Pharmacie",
    item: "Lot A123 - Antiseptique",
    steps: [
      { title: "Lot + péremption", text: "Ajoutez le lot et la date, alertes 30/90 jours." },
      { title: "Emplacement", text: "Réserve, rayon, frigo ou coffre." },
      { title: "Pertes & traçabilité", text: "Déclarez casse / péremption, exports propres." },
      { title: "Exports santé", text: "CSV/XLSX structuré pour votre suivi." },
    ],
  },
  camping: {
    service: "Établissement",
    item: "Switch Bar ↔ Boutique",
    steps: [
      { title: "Changer de service", text: "Épicerie, bar, boutique : règles adaptées." },
      { title: "Ajout rapide", text: "Formulaire allégé selon le service choisi." },
      { title: "Export consolidé", text: "Direction : export global + par service." },
      { title: "Pertes par service", text: "Chaque perte reste dans son service." },
    ],
  },
};

export default function AutoDemoBlock({ title = "Auto-démo", className = "", variant = "restaurant" }) {
  const preset = presets[variant] || presets.restaurant;
  const steps = preset.steps;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % steps.length), 2600);
    return () => clearInterval(t);
  }, []);

  const current = steps[index];
  const next = steps[(index + 1) % steps.length];

  return (
    <div className={`rounded-2xl bg-slate-900 text-slate-50 p-6 shadow-lg overflow-hidden ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-blue-200 uppercase tracking-wide font-semibold">{title}</p>
          <h3 className="text-xl font-semibold">Voyez l’outil en action sans créer de compte</h3>
        </div>
        <span className="text-xs bg-white/10 rounded-full px-3 py-1 text-blue-100">Mode visiteur</span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="rounded-xl bg-slate-800 p-4 border border-slate-700 shadow-inner"
            >
              <p className="text-sm text-blue-200">Étape en cours</p>
              <p className="text-lg font-semibold mt-1">{current.title}</p>
              <p className="text-sm text-slate-200 mt-1">{current.text}</p>
            </motion.div>
          </AnimatePresence>
          <div className="text-xs text-slate-300">Défilement auto. Changez de service, testez l’export, déclarez une perte.</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-blue-500/20 via-slate-800 to-slate-900 border border-slate-700 p-4 space-y-3">
          <div className="text-sm text-blue-100">Prévisualisation</div>
          <div className="rounded-lg bg-slate-900/60 border border-slate-700 p-3 space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Service : {preset.service}</span>
              <span>Mois : Déc 2025</span>
            </div>
            <div className="rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-100">Produit : {preset.item}</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-200">
              <div className="rounded bg-slate-800 px-2 py-1">Étape : {current.title}</div>
              <div className="rounded bg-slate-800 px-2 py-1">Service ciblé</div>
              <div className="rounded bg-slate-800 px-2 py-1">Action : {current.text}</div>
              <div className="rounded bg-slate-800 px-2 py-1">Prochaine : {next.title}</div>
            </div>
            <div className="rounded bg-slate-800 px-3 py-2 text-xs text-blue-200">
              Prochaine étape : {next.title} — {next.text}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
