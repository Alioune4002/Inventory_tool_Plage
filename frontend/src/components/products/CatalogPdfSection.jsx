// frontend/src/components/products/CatalogPdfSection.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../ui/Card";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Select from "../../ui/Select";
import Badge from "../../ui/Badge";
import { ScanLine, Plus, Trash2 } from "lucide-react";
import { cn } from "../../lib/cn";

function ScanButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Scanner un code-barres"
      aria-label="Scanner un code-barres"
      className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--accent)]/10"
    >
      <ScanLine className="h-4 w-4" />
      <span className="hidden sm:inline">Scanner</span>
    </button>
  );
}

export default function CatalogPdfSection({
  canPdfCatalog,
  pdfLimit,
  services,
  pdfService,
  setPdfService,
  pdfServiceOptions,
  pdfQuery,
  setPdfQuery,
  categories,
  pdfCategory,
  setPdfCategory,
  categoryOptions,
  wording,
  pdfFieldOptions,
  pdfFields,
  togglePdfField,
  pdfBranding,
  setPdfBranding,
  pdfTemplate,
  setPdfTemplate,
  pdfLogo,
  setPdfLogo,
  templateOptions,
  generateCatalogPdf,
  pdfLoading,
  pdfError,
  pdfErrorCode,
  clearPdfError,

  // ✅ new
  allProducts = [],
  catalogSelectedIds = [],
  setCatalogSelectedIds,
  onOpenScanner,
}) {
  const [mode, setMode] = useState("composer"); // "composer" | "options"
  const [categoryBulk, setCategoryBulk] = useState("");
  const queryRef = useRef(null);

  const effectiveService = pdfService || "";

  const canMultiServices = (services || []).length > 1;

  const filteredForPicker = useMemo(() => {
    const q = (pdfQuery || "").trim().toLowerCase();
    const cat = (pdfCategory || "").trim().toLowerCase();

    return (allProducts || [])
      .filter((p) => {
        if (effectiveService && String(effectiveService) !== "all") {
          if (String(p.service) !== String(effectiveService)) return false;
        }

        if (cat) {
          const pc = String(p.category || "").toLowerCase();
          // si catégories chargées pour un service : match strict
          if ((categories || []).length > 0 && String(effectiveService) !== "all") {
            if (pc !== cat) return false;
          } else {
            if (!pc.includes(cat)) return false;
          }
        }

        if (!q) return true;
        return (
          p.name?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.internal_sku?.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [allProducts, pdfQuery, pdfCategory, effectiveService, categories]);

  const selectedProducts = useMemo(() => {
    const set = new Set((catalogSelectedIds || []).map(String));
    return (allProducts || []).filter((p) => set.has(String(p.id)));
  }, [allProducts, catalogSelectedIds]);

  const addOne = (p) => {
    setCatalogSelectedIds((prev) => {
      const s = new Set((prev || []).map(String));
      s.add(String(p.id));
      return Array.from(s);
    });
  };

  const removeOne = (id) => {
    setCatalogSelectedIds((prev) => (prev || []).filter((x) => String(x) !== String(id)));
  };

  const clearAll = () => setCatalogSelectedIds([]);

  const addByCategory = () => {
    const cat = String(categoryBulk || "").trim();
    if (!cat) return;

    const pool = (allProducts || []).filter((p) => {
      if (effectiveService && String(effectiveService) !== "all") {
        if (String(p.service) !== String(effectiveService)) return false;
      }
      return String(p.category || "") === cat;
    });

    if (!pool.length) return;

    setCatalogSelectedIds((prev) => {
      const s = new Set((prev || []).map(String));
      pool.forEach((p) => s.add(String(p.id)));
      return Array.from(s);
    });
  };

  useEffect(() => {
    // quand on change de service, on reset la catégorie bulk (sinon confusion)
    setCategoryBulk("");
  }, [effectiveService]);

  return (
    <Card className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-[var(--muted)]">Catalogue PDF</div>
          <div className="text-lg font-semibold text-[var(--text)]">Sélection & génération</div>
          <div className="text-sm text-[var(--muted)]">
            Sélectionne les produits à inclure (recherche live, par catégorie, multi-services), puis génère ton PDF.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant={mode === "composer" ? "secondary" : "ghost"} onClick={() => setMode("composer")}>
            Composer
          </Button>
          <Button variant={mode === "options" ? "secondary" : "ghost"} onClick={() => setMode("options")}>
            Options PDF
          </Button>
        </div>
      </div>

      {/* Entitlements */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-[var(--muted)]">
          {canPdfCatalog ? (
            <>
              {pdfLimit === null ? "Limite mensuelle : illimitée" : `Limite mensuelle : ${pdfLimit} PDF`}
            </>
          ) : (
            "Catalogue PDF non inclus dans votre plan."
          )}
        </div>
        <Badge variant="info">{selectedProducts.length} produit(s) sélectionné(s)</Badge>
      </div>

      {/* Service */}
      {canMultiServices && (
        <Select
          label="Service du catalogue"
          value={pdfService || ""}
          onChange={(v) => setPdfService(v)}
          options={pdfServiceOptions}
          helper="Choisis un service (ou Tous) pour composer ton catalogue."
        />
      )}

      {/* Errors */}
      {pdfError ? (
        <div className="rounded-2xl border border-red-200/70 dark:border-red-400/25 bg-red-50/70 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
          {pdfError}
          {pdfErrorCode ? <div className="text-xs mt-1 opacity-75">Code: {pdfErrorCode}</div> : null}
          <div className="mt-2">
            <Button variant="secondary" size="sm" onClick={clearPdfError}>
              Fermer
            </Button>
          </div>
        </div>
      ) : null}

      {/* MODE: COMPOSER */}
      {mode === "composer" ? (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <Input
              label="Recherche live (nom / EAN / SKU)"
              placeholder="Tape… les résultats apparaissent en live"
              value={pdfQuery}
              inputRef={queryRef}
              onChange={(e) => setPdfQuery(e.target.value)}
              rightSlot={onOpenScanner ? <ScanButton onClick={onOpenScanner} /> : null}
            />

            <Select
              label="Filtrer par catégorie"
              value={pdfCategory}
              onChange={(v) => setPdfCategory(v)}
              options={categoryOptions}
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setPdfQuery("");
                  setPdfCategory("");
                  queryRef.current?.focus?.();
                }}
              >
                Reset
              </Button>
              <Button onClick={() => generateCatalogPdf({ selectedIdsOverride: catalogSelectedIds })} loading={pdfLoading} disabled={!canPdfCatalog}>
                Générer PDF
              </Button>
            </div>
          </div>

          {/* Bulk by category */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
            <div className="text-sm font-semibold text-[var(--text)]">Ajout rapide par catégorie / rayon</div>
            <div className="text-xs text-[var(--muted)]">
              Ajoute tous les produits d’une catégorie, puis retire ceux que tu ne veux pas dans la sélection.
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Select
                label="Catégorie à ajouter"
                value={categoryBulk}
                onChange={(v) => setCategoryBulk(v)}
                options={categoryOptions}
              />
              <Button
                variant="secondary"
                onClick={addByCategory}
                disabled={!categoryBulk}
              >
                <Plus className="h-4 w-4" /> Ajouter toute la catégorie
              </Button>
              <Button variant="ghost" onClick={clearAll} disabled={!selectedProducts.length}>
                <Trash2 className="h-4 w-4" /> Vider sélection
              </Button>
            </div>
          </div>

          {/* Live results */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-[var(--text)]">Résultats</div>
            {filteredForPicker.length === 0 ? (
              <div className="text-sm text-[var(--muted)]">Aucun résultat. Essayez un autre mot-clé.</div>
            ) : (
              <div className="space-y-2">
                {filteredForPicker.map((p) => {
                  const isSelected = (catalogSelectedIds || []).some((x) => String(x) === String(p.id));
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2",
                        isSelected
                          ? "border-emerald-400/60 bg-emerald-500/10"
                          : "border-[var(--border)] bg-[var(--surface)]"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text)] truncate">{p.name}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {p.barcode || p.internal_sku || "—"} · {p.category || "—"}
                        </div>
                      </div>

                      {isSelected ? (
                        <Button size="sm" variant="secondary" onClick={() => removeOne(p.id)}>
                          Retirer
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => addOne(p)}>
                          Ajouter
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[var(--text)]">Sélection</div>
              <Badge variant="info">{selectedProducts.length}</Badge>
            </div>

            {selectedProducts.length === 0 ? (
              <div className="text-sm text-[var(--muted)]">Aucun produit sélectionné.</div>
            ) : (
              <div className="space-y-2">
                {selectedProducts.slice(0, 60).map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)] truncate">{p.name}</div>
                      <div className="text-xs text-[var(--muted)]">{p.category || "—"}</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => removeOne(p.id)}>
                      Retirer
                    </Button>
                  </div>
                ))}
                {selectedProducts.length > 60 && (
                  <div className="text-xs text-[var(--muted)]">(+{selectedProducts.length - 60} autres)</div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* MODE: OPTIONS */
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <Select
              label="Template"
              value={pdfTemplate}
              onChange={(v) => setPdfTemplate(v)}
              options={templateOptions}
            />
            <Input
              label="Logo (optionnel)"
              type="file"
              accept="image/*"
              onChange={(e) => setPdfLogo(e.target.files?.[0] || null)}
              helper={pdfLogo ? `Sélectionné : ${pdfLogo.name}` : "2 Mo max (PNG/JPG/SVG)."}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Input
              label="Nom entreprise"
              value={pdfBranding.company_name || ""}
              onChange={(e) => setPdfBranding((p) => ({ ...p, company_name: e.target.value }))}
            />
            <Input
              label="Email"
              value={pdfBranding.company_email || ""}
              onChange={(e) => setPdfBranding((p) => ({ ...p, company_email: e.target.value }))}
            />
            <Input
              label="Téléphone"
              value={pdfBranding.company_phone || ""}
              onChange={(e) => setPdfBranding((p) => ({ ...p, company_phone: e.target.value }))}
            />
            <Input
              label="Adresse"
              value={pdfBranding.company_address || ""}
              onChange={(e) => setPdfBranding((p) => ({ ...p, company_address: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-[var(--text)]">Champs à afficher</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {pdfFieldOptions.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--primary)]"
                    checked={pdfFields.includes(f.key)}
                    onChange={() => togglePdfField(f.key)}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMode("composer")}>
              Retour
            </Button>
            <Button onClick={() => generateCatalogPdf({ selectedIdsOverride: catalogSelectedIds })} loading={pdfLoading} disabled={!canPdfCatalog}>
              Générer PDF
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}