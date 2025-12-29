import React from "react";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Select from "../../ui/Select";

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
}) {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm text-[var(--muted)]">Catalogue PDF (pro)</div>
          <div className="text-lg font-semibold text-[var(--text)]">Catalogue PDF</div>
          <div className="text-sm text-[var(--muted)]">
            Générez un PDF paginé et propre à partager (A4). Sans images produit, rapide et léger.
          </div>
        </div>
        <div className="text-xs text-[var(--muted)]">
          {pdfLimit === null ? "Limite mensuelle : illimitée" : `Limite mensuelle : ${pdfLimit} catalogue(s)`}
        </div>
      </div>

      {!canPdfCatalog && (
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/70 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 flex flex-wrap items-center justify-between gap-3">
          <span>Catalogue PDF réservé aux plans Duo et Multi.</span>
          <Button size="sm" onClick={() => (window.location.href = "/tarifs")}>
            Voir les plans
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            {services?.length > 0 && (
              <Select
                label="Service"
                value={pdfService || ""}
                onChange={(value) => {
                  setPdfService(value);
                  clearPdfError();
                }}
                options={pdfServiceOptions}
              />
            )}
            <Input
              label="Recherche"
              placeholder="Nom, code-barres, SKU…"
              value={pdfQuery}
              onChange={(e) => {
                setPdfQuery(e.target.value);
                clearPdfError();
              }}
            />
            {categories.length > 0 && pdfService !== "all" ? (
              <Select
                label={wording.categoryLabel}
                value={pdfCategory}
                onChange={(value) => {
                  setPdfCategory(value);
                  clearPdfError();
                }}
                options={categoryOptions}
              />
            ) : (
              <Input
                label={wording.categoryLabel}
                placeholder="Filtrer une catégorie (optionnel)"
                value={pdfCategory}
                onChange={(e) => {
                  setPdfCategory(e.target.value);
                  clearPdfError();
                }}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-[var(--text)]">Champs à inclure</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {pdfFieldOptions.map((field) => {
                const checked = pdfFields.includes(field.key);
                return (
                  <label
                    key={field.key}
                    className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={checked}
                      onChange={() => {
                        togglePdfField(field.key);
                        clearPdfError();
                      }}
                    />
                    <span>{field.label}</span>
                  </label>
                );
              })}
            </div>
            <div className="text-xs text-[var(--muted)]">
              Astuce : pour un catalogue compact, gardez uniquement Identifiants + Unité.
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Identité</div>
          <Select
            label="Style"
            value={pdfTemplate}
            onChange={(value) => {
              setPdfTemplate(value);
              clearPdfError();
            }}
            options={templateOptions}
          />
          <Input
            label="Nom d’entreprise"
            value={pdfBranding.company_name}
            onChange={(e) => {
              setPdfBranding((prev) => ({ ...prev, company_name: e.target.value }));
              clearPdfError();
            }}
          />
          <Input
            label="Email"
            value={pdfBranding.company_email}
            onChange={(e) => {
              setPdfBranding((prev) => ({ ...prev, company_email: e.target.value }));
              clearPdfError();
            }}
          />
          <Input
            label="Téléphone"
            value={pdfBranding.company_phone}
            onChange={(e) => {
              setPdfBranding((prev) => ({ ...prev, company_phone: e.target.value }));
              clearPdfError();
            }}
          />
          <Input
            label="Adresse"
            value={pdfBranding.company_address}
            onChange={(e) => {
              setPdfBranding((prev) => ({ ...prev, company_address: e.target.value }));
              clearPdfError();
            }}
          />
          <label className="block space-y-1.5 text-sm text-[var(--text)]">
            <span className="text-sm font-medium text-[var(--text)]">Logo (optionnel)</span>
            <input
              type="file"
              accept="image/*"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              onChange={(e) => {
                const next = e.target.files?.[0] || null;
                setPdfLogo(next);
                clearPdfError();
              }}
            />
            {pdfLogo ? (
              <span className="text-xs text-[var(--muted)]">Fichier sélectionné : {pdfLogo.name}</span>
            ) : null}
            <span className="text-xs text-[var(--muted)]">
              Utilisé en couverture pour un rendu premium. Formats PNG/JPG recommandés.
            </span>
          </label>
          <Button onClick={generateCatalogPdf} loading={pdfLoading} disabled={!canPdfCatalog || pdfLoading}>
            Générer le PDF
          </Button>
        </div>
      </div>

      {pdfError && (
        <div className="rounded-2xl border border-red-200/70 bg-red-50/70 dark:bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200 flex flex-wrap items-center justify-between gap-3">
          <span>{pdfError}</span>
          {(pdfErrorCode === "LIMIT_PDF_CATALOG_MONTH" || pdfErrorCode === "FEATURE_NOT_INCLUDED") && (
            <Button size="sm" variant="secondary" onClick={() => (window.location.href = "/tarifs")}>
              Voir les plans
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
