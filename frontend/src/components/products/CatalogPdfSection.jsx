// frontend/src/components/products/CatalogPdfSection.jsx
import React from "react";
import Card from "../../ui/Card";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Select from "../../ui/Select";
import Badge from "../../ui/Badge";
import { ScanLine } from "lucide-react";

function ScannerButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-full border border-[var(--border)] p-2 text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/10"
      title="Scanner un code-barres"
      aria-label="Scanner un code-barres"
    >
      <ScanLine className="h-4 w-4" />
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
  pdfPreviewItems = [],
  pdfPreviewCount = 0,
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
  clearPdfError,
  onOpenScanner,
  barcodeEnabled,
}) {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-[var(--text)]">Catalogue PDF</div>
          <div className="text-xs text-[var(--muted)]">
            Ici tu filtres le <b>référentiel produits</b> et tu génères un PDF (pour imprimeur, fournisseurs, catalogue interne…).
          </div>
        </div>

        <div className="flex items-center gap-2">
          {typeof pdfLimit === "number" ? (
            <Badge variant="info">Limite mensuelle : {pdfLimit} PDF</Badge>
          ) : (
            <Badge variant="info">Limite mensuelle : illimitée</Badge>
          )}
        </div>
      </div>

      {!canPdfCatalog && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
          Catalogue PDF non inclus dans votre plan.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3 items-end">
        {services?.length > 0 && (
          <Select
            label="Service"
            value={pdfService || ""}
            onChange={(v) => setPdfService(v)}
            options={pdfServiceOptions}
          />
        )}

        <Input
          label="Recherche catalogue"
          placeholder="Nom, code-barres, SKU…"
          value={pdfQuery}
          onChange={(e) => setPdfQuery(e.target.value)}
          rightSlot={
            barcodeEnabled ? <ScannerButton onClick={onOpenScanner} /> : null
          }
        />

        <Select
          label="Catégorie"
          value={pdfCategory}
          onChange={(v) => setPdfCategory(v)}
          options={categoryOptions}
          helper={categories?.length ? "Catégories du service." : "Filtre texte si catégories non chargées."}
        />
      </div>

      {/* ✅ Live preview */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm font-semibold text-[var(--text)]">Aperçu (live)</div>
          <div className="text-xs text-[var(--muted)]">
            {pdfPreviewCount} produit(s) correspondent · aperçu {Math.min(8, pdfPreviewCount)}
          </div>
        </div>

        {pdfPreviewCount === 0 ? (
          <div className="mt-2 text-sm text-[var(--muted)]">Aucun produit ne correspond aux filtres.</div>
        ) : (
          <div className="mt-3 grid gap-2">
            {pdfPreviewItems.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)] truncate">{p.name}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {(p.barcode || p.internal_sku || "—")} · {p.category || "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Champs PDF */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-[var(--text)]">Champs à inclure</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {pdfFieldOptions.map((opt) => (
            <label
              key={opt.key}
              className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--primary)]"
                checked={pdfFields.includes(opt.key)}
                onChange={() => togglePdfField(opt.key)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Branding / template */}
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="Nom de l’entreprise"
          value={pdfBranding.company_name || ""}
          onChange={(e) => setPdfBranding((p) => ({ ...p, company_name: e.target.value }))}
        />
        <Select
          label="Template"
          value={pdfTemplate}
          onChange={(v) => setPdfTemplate(v)}
          options={templateOptions}
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
        <div className="space-y-1">
          <div className="text-sm font-medium text-[var(--text)]">Logo (optionnel)</div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPdfLogo(e.target.files?.[0] || null)}
            className="block w-full text-sm text-[var(--muted)]"
          />
          {pdfLogo ? <div className="text-xs text-[var(--muted)]">Sélectionné : {pdfLogo.name}</div> : null}
        </div>
      </div>

      {pdfError ? (
        <div className="rounded-2xl border border-red-200/70 dark:border-red-400/25 bg-red-50/70 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
          {pdfError}
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={clearPdfError}>
              Fermer
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={generateCatalogPdf} loading={pdfLoading} disabled={pdfLoading || !canPdfCatalog}>
          Générer le PDF
        </Button>
      </div>
    </Card>
  );
}