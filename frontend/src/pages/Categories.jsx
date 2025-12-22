import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Skeleton from "../ui/Skeleton";
import PageTransition from "../components/PageTransition";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";
import { FAMILLES, resolveFamilyId } from "../lib/famillesConfig";

export default function Categories() {
  const { serviceId, tenant, services } = useAuth();
  const pushToast = useToast();
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const currentService = services?.find((s) => String(s.id) === String(serviceId));
  const serviceType = currentService?.service_type;
  const familyId = resolveFamilyId(serviceType, tenant?.domain);
  const familyMeta = FAMILLES.find((family) => family.id === familyId) ?? FAMILLES[0];
  const categoryLabel = familyMeta.labels?.categoryLabel || "Categorie";
  const categoryLabelLower = categoryLabel.toLowerCase();
  const defaultCategories = familyMeta.examples?.categories || [];
  const PAGE_SIZE = 12;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }, [list, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
      setPage(1);
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
      setPage(1);
      pushToast?.({ message: "Catégorie supprimée.", type: "success" });
    } catch (e) {
      pushToast?.({ message: "Suppression impossible.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const prefill = async () => {
    if (!serviceId || defaultCategories.length === 0) return;
    for (const d of defaultCategories) {
      try {
        await api.post("/api/categories/", { name: d, service: serviceId });
      } catch (_) {
        /* ignore duplicates */
      }
    }
    load();
  };
  const showSkeleton = loading && list.length === 0;

  return (
    <PageTransition>
      <Helmet>
        <title>Catégories | StockScan</title>
        <meta name="description" content="Organisez vos catégories métier." />
      </Helmet>

      <div className="space-y-4">
        <Card className="p-6 space-y-2">
          <div className="text-sm text-slate-500">Catégories</div>
          <h1 className="text-2xl font-black">Organisez vos {categoryLabelLower}</h1>
          <p className="text-slate-600 text-sm">
            Ajoutez, renommez ou supprimez vos {categoryLabelLower}.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <Input
              label={`Nouveau ${categoryLabelLower}`}
              placeholder={familyMeta.placeholders?.category || `Ex. ${categoryLabel}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="md:col-span-2 flex gap-3">
              <Button onClick={add} loading={loading} className="shrink-0">Ajouter</Button>
              <Button variant="secondary" onClick={() => setName("")} className="shrink-0">Réinitialiser</Button>
              {defaultCategories.length > 0 && (
                <Button variant="ghost" onClick={prefill} className="shrink-0">
                  Pré-remplir (recommandé)
                </Button>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {showSkeleton
              ? Array.from({ length: 6 }).map((_, idx) => <Skeleton key={idx} className="h-12 w-full" />)
              : paginated.map((cat) => (
                  <Card key={cat.id || cat.name} className="p-4 flex items-center justify-between" hover>
                    <div className="font-semibold text-slate-900">{cat.name || cat}</div>
                    <Button variant="ghost" size="sm" onClick={() => remove(cat)}>
                      Supprimer
                    </Button>
                  </Card>
                ))}
            {!showSkeleton && !paginated.length && (
              <Card className="p-4 text-slate-500 text-sm">
                Aucune {categoryLabelLower} pour ce service. Ajoutez-en ou pré-remplissez.
              </Card>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {page} / {totalPages} · {list.length} {categoryLabelLower}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
              >
                Précédent
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
              >
                Suivant
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
