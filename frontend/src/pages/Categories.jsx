import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import PageTransition from "../components/PageTransition";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";

export default function Categories() {
  const { serviceId, tenant, services } = useAuth();
  const pushToast = useToast();
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const currentService = services?.find((s) => String(s.id) === String(serviceId));
  const serviceType = currentService?.service_type;
  const serviceDomain = serviceType === "retail_general" ? "general" : tenant?.domain;
  const isFood = serviceDomain !== "general";

  const load = async () => {
    if (!serviceId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/categories/?service=${serviceId}`);
      setList(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      pushToast?.({ message: "Impossible de charger les catégories (auth ou service).", type: "error" });
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  const add = async () => {
    if (!name.trim() || !serviceId) return;
    setLoading(true);
    try {
      const res = await api.post("/api/categories/", { name: name.trim(), service: serviceId });
      setList((prev) => [...prev, res.data]);
      setName("");
      pushToast?.({ message: "Catégorie ajoutée.", type: "success" });
    } catch (e) {
      const msg = e?.response?.data?.detail || "Ajout impossible (doublon ou droits).";
      pushToast?.({ message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const remove = async (cat) => {
    if (!cat?.id) return;
    setLoading(true);
    try {
      await api.delete(`/api/categories/${cat.id}/?service=${serviceId}`);
      setList((prev) => prev.filter((c) => c.id !== cat.id));
      pushToast?.({ message: "Catégorie supprimée.", type: "success" });
    } catch (e) {
      pushToast?.({ message: "Suppression impossible.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const prefill = async () => {
    if (!isFood || !serviceId) return;
    const defaults = ["Frais", "Sec", "Surgelé", "Boissons", "Produits entretien", "Packaging"];
    for (const d of defaults) {
      try {
        await api.post("/api/categories/", { name: d, service: serviceId });
      } catch (_) {
        /* ignore duplicates */
      }
    }
    load();
  };

  return (
    <PageTransition>
      <Helmet>
        <title>Catégories | StockScan</title>
        <meta name="description" content="Organisez vos familles de produits." />
      </Helmet>

      <div className="space-y-4">
        <Card className="p-6 space-y-2">
          <div className="text-sm text-slate-500">Catégories</div>
          <h1 className="text-2xl font-black">Organisez vos familles</h1>
          <p className="text-slate-600 text-sm">Ajoutez, renommez ou supprimez vos catégories.</p>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <Input
              label="Nouvelle catégorie"
              placeholder={isFood ? "Ex. Produits frais" : "Ex. Vêtements / Bijoux / Accessoires"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="md:col-span-2 flex gap-3">
              <Button onClick={add} loading={loading} className="shrink-0">Ajouter</Button>
              <Button variant="secondary" onClick={() => setName("")} className="shrink-0">Réinitialiser</Button>
              {isFood && (
                <Button variant="ghost" onClick={prefill} className="shrink-0">
                  Pré-remplir (food)
                </Button>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {list.map((cat) => (
              <Card key={cat.id || cat.name} className="p-4 flex items-center justify-between" hover>
                <div className="font-semibold text-slate-900">{cat.name || cat}</div>
                <Button variant="ghost" size="sm" onClick={() => remove(cat)}>Supprimer</Button>
              </Card>
            ))}
            {!list.length && (
              <Card className="p-4 text-slate-500 text-sm">
                Aucune catégorie pour ce service. Ajoutez-en ou pré-remplissez (food).
              </Card>
            )}
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
