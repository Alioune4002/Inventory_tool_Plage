# StockScan Runbook (minimal)

## Dev
Backend:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

## Prod (key env)
- DJANGO_SECRET_KEY, DJANGO_DEBUG=false, DJANGO_ALLOWED_HOSTS, DATABASE_URL.
- FRONTEND_URL, CORS_ALLOWED_ORIGINS.
- STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET (if billing).
- SENDGRID_API_KEY, SENDGRID_FROM_EMAIL (if emails enabled).
- OPENAI_API_KEY, AI_ENABLED=true (if AI assistant enabled).
- AI_MODEL_LIGHT (optionnel), AI_MODEL_FULL (optionnel) pour ajuster les modeles IA.
- VITE_API_BASE_URL on the frontend.
- VITE_SENTRY_DSN (optionnel) pour la remontée d’erreurs front.

## Smoke tests (examples)
```bash
# health
curl -sS https://<api-host>/health/

# login (replace credentials)
curl -sS -X POST https://<api-host>/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}'

# export (token required)
curl -sS -X GET "https://<api-host>/api/exports/?from=2025-01&to=2025-01&service=all&format=csv" \
  -H "Authorization: Bearer <token>"

# catalogue PDF (token required)
curl -sS -X GET "https://<api-host>/api/catalog/pdf/?service=all&fields=barcode,sku,unit" \
  -H "Authorization: Bearer <token>" -o /tmp/catalogue.pdf

# etiquettes PDF (token required)
curl -sS -X GET "https://<api-host>/api/labels/pdf/?service=all&ids=1,2&fields=price,unit" \
  -H "Authorization: Bearer <token>" -o /tmp/labels.pdf
```
Automated smoke (pytest):
```bash
cd backend
pytest tests/test_smoke_flows.py -q
```

## E2E UI (Playwright)
Pré-requis:
- `npm install` dans `frontend`
- `npx playwright install`
- Variables d'env: `E2E_USER`, `E2E_PASS` (et `E2E_BASE_URL` si vous ciblez un déploiement).

Run:
```bash
cd frontend
E2E_USER="demo" E2E_PASS="demo123" npm run test:e2e
```

## Metrics (/metrics)
- Endpoint Prometheus : `GET /metrics/`
- Retourne 503 si `prometheus-client` n'est pas installe.
- Compteurs principaux: `stockscan_off_lookup_failures_total`, `stockscan_export_events_total`, `stockscan_ai_requests_total`.
- `stockscan_ai_requests_total` expose les labels `mode` (light/full) et `template_used` (true/false).

Exemple:
```bash
curl -sS https://<api-host>/metrics/ | head -n 20
```

## Observabilite front (Sentry)
- Activer `VITE_SENTRY_DSN` sur le frontend.
- Configurer une alerte Sentry (erreurs >= 5 / 10 min) + notification email/Slack.

## QA mobile (Réceptions / Étiquettes)
1. Réceptions
   - Ouvrir le drawer, choisir service + fichier CSV/PDF, importer.
   - Vérifier que le mapping s’affiche et que “Appliquer la réception” fonctionne.
2. Étiquettes
   - Ouvrir le drawer, rechercher un produit, l’ajouter à la sélection.
   - Générer le PDF et valider le téléchargement.
3. Accessibilité
   - Le focus reste dans le drawer et la touche Échap ferme le panneau.

Checklist complète: `QA_MOBILE.md`

## Emails en doublon (strategie safe)
Important: la migration `0017_unique_email_index` ne cree PAS l'index si des doublons (case-insensitive) existent. Elle logue un warning et fait un no-op.

1. Reporter les doublons (normalisation lower) :
```bash
python manage.py report_duplicate_emails --csv /tmp/duplicate_emails.csv
```
2. Pour chaque email en doublon :
   - Identifier le compte principal (support + verification).
   - Contacter les utilisateurs concernes pour choisir un email unique.
   - Mettre a jour les emails dans l'admin ou via support (ne jamais modifier silencieusement).
3. Verifier qu'il n'y a plus de doublons :
```bash
python manage.py report_duplicate_emails
```
4. Ajouter l'index unique une fois tous les doublons resolus (migration dediee ou SQL) :
```sql
CREATE UNIQUE INDEX IF NOT EXISTS auth_user_email_lower_uniq
ON auth_user (LOWER(email))
WHERE email IS NOT NULL AND email <> '';
```

## Incidents frequents
OpenFoodFacts (OFF) down / pre-remplissage indisponible:
- Log tag: `OFF_LOOKUP_FAILED` (warning) + compteur cache `off_lookup_errors:YYYY-MM-DD`.
- Debug rapide:
```bash
curl -sS "https://<api-host>/api/products/lookup/?barcode=123456" \
  -H "Authorization: Bearer <token>"
```
- Attendu: `{"found": false, "off_error": "..."}` si OFF est down.

LIMIT_EXPORT_*:
- Verifier plan/entitlements:
```bash
curl -sS "https://<api-host>/api/auth/me/org/entitlements" \
  -H "Authorization: Bearer <token>"
```
- Compter les exports du mois (shell):
```bash
python manage.py shell -c "from products.models import ExportEvent; from django.utils import timezone; \
start=timezone.now().replace(day=1,hour=0,minute=0,second=0,microsecond=0); \
print(ExportEvent.objects.filter(created_at__gte=start).count())"
```

LIMIT_AI_*:
- Verifier entitlements (endpoint ci-dessus).
  - Compter l'usage IA du mois (shell):
```bash
python manage.py shell -c "from ai_assistant.models import AIRequestEvent; from django.utils import timezone; \
start=timezone.now().replace(day=1,hour=0,minute=0,second=0,microsecond=0); \
print(AIRequestEvent.objects.filter(created_at__gte=start).count())"
```

LIMIT_PDF_CATALOG_MONTH / LIMIT_LABELS_PDF_MONTH / LIMIT_RECEIPTS_IMPORT_MONTH:
- Verifier entitlements (endpoint entitlements).
- Compter l'usage du mois (shell):
```bash
python manage.py shell -c "from products.models import CatalogPdfEvent, LabelPdfEvent, ReceiptImportEvent; from django.utils import timezone; \
start=timezone.now().replace(day=1,hour=0,minute=0,second=0,microsecond=0); \
print('catalog', CatalogPdfEvent.objects.filter(created_at__gte=start).count()); \
print('labels', LabelPdfEvent.objects.filter(created_at__gte=start).count()); \
print('imports', ReceiptImportEvent.objects.filter(created_at__gte=start).count())"
```

## Quick triage
- 401 loop: token expired or CORS misconfig.
- 403 LIMIT_*: entitlement over limit (check plan/usage).
- 502 Stripe: STRIPE_* missing or webhook secret invalid.
