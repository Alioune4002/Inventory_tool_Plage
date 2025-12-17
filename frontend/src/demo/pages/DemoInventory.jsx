import React, { useMemo, useState } from "react";
import Card from "../../ui/Card";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import { ScanLine } from "lucide-react";
import { useDemo } from "../context/DemoProvider";

export default function DemoInventory() {
  const { month, setMonth, services, serviceId, selectService, items, categories, pushToast } = useDemo();
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState({ name: "", category: "", quantity: 1, barcode: "" });

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((p) => p.name?.toLowerCase().includes(q) || p.barcode?.includes(q) || p.internal_sku?.includes(q));
  }, [items, search]);

  const simulateScan = () => {
    setQuick((p) => ({ ...p, barcode: "3254381023456", name: "Eau 1.5L", category: "Boissons", quantity: 24 }));
    pushToast("Scan OK : champs préremplis.", "success");
  };

  return (
    <div className="grid gap-4">
      <Card className="p-6 space-y-3">
        <div className="text-sm text-slate-500">Inventaire</div>
        <div className="text-2xl font-black tracking-tight">Inventaire du mois</div>

        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <Input label="Mois" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Service</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
              value={serviceId}
              onChange={(e) => selectService(e.target.value)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <Input label="Recherche" placeholder="Nom, EAN, SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <div className="text-sm font-semibold text-slate-800">Ajout rapide</div>

        <div className="grid md:grid-cols-4 gap-3 items-end">
          <Input label="Produit" value={quick.name} onChange={(e) => setQuick((p) => ({ ...p, name: e.target.value }))} />
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Catégorie</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
              value={quick.category}
              onChange={(e) => setQuick((p) => ({ ...p, category: e.target.value }))}
            >
              <option value="">Aucune</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </label>
          <Input label="Quantité" type="number" min={0} value={quick.quantity} onChange={(e) => setQuick((p) => ({ ...p, quantity: e.target.value }))} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={simulateScan} className="w-full flex justify-center gap-2">
              <ScanLine className="w-4 h-4" /> Scanner
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-slate-600">
                <th className="text-left px-4 py-3">Produit</th>
                <th className="text-left px-4 py-3">Catégorie</th>
                <th className="text-left px-4 py-3">Mois</th>
                <th className="text-left px-4 py-3">Quantité</th>
                <th className="text-left px-4 py-3">EAN / SKU</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => (
                <tr key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-700">{p.category || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{p.inventory_month}</td>
                  <td className="px-4 py-3 text-slate-700">{p.quantity}</td>
                  <td className="px-4 py-3 text-slate-700">{p.barcode || p.internal_sku || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}