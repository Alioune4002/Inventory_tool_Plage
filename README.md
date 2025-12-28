# StockScan (Inventarium)

SaaS léger pour gérer des inventaires multi-enseignes et multi-services, avec ou sans code-barres. Frontend React (Vite + Tailwind) et backend Django/DRF (JWT, multi-tenant, exports).

- **Backend prod** : https://inventory-tool-plage.onrender.com (Render).  
- `backend/` : API Django REST (DRF + SimpleJWT). Multi-tenant, multi-services, exports CSV/XLSX.
- `frontend/` : Vite + React + Tailwind (UI premium, animations Framer Motion).
- `dist/` : build statique généré par `npm run build`.

## Fonctionnalités clés
- Auth JWT : register/login/me, refresh, suppression de compte.
- Multi-tenant, multi-services : sélection de service côté front, requêtes scoping tenant/service.
- Onboarding : choix du business type (restaurant, bar, épicerie, boutique, camping_multi, autre), services uniques ou multiples avec presets (kitchen/bar/retail/etc.).
- Service profiles : `service_type`, `counting_mode` (unit/weight/volume/mixed), `features` (barcode/sku/prices/dlc…).
- Produits : champs optionnels (barcode/SKU, prix achat/vente, DLC, unités pcs/kg/g/l/ml). Gestion entamé/non entamé (`container_status`, pack_size, remaining_qty/fraction), warnings “soft” si infos manquantes.
- Pertes : déclaration de pertes (casse/DLC/vol/offert/erreur), impact dans les stats mensuelles, option de désactiver entamé/non entamé pour les services retail/pharma.
- Exports : `/api/exports/` CSV/XLSX (from/to, service/all, mode sealed/opened/all) + envoi par email (param `email` + `message`).
- Inventaire : filtre mois/service, ajout produit rapide, search, empty state premium.
- Inventaire Chrono : timer + objectif + progression (mode optionnel).
- Lookup / Scan : `/api/products/lookup/?barcode=` cherche d’abord dans le tenant/service, renvoie historique + derniers produits; fallback OpenFoodFacts (alimentaire) pour préremplir.
- Alertes : stock minimum + DLC/DDM (seuils 30/90j) via `/api/alerts/` (plan Duo/Multi).
- Variantes & conversions : variantes simples + conversions d’unités par produit (affichées dans exports/stats).
- Rétention Solo : 14 jours (filtrage created_at) pour inventaires, pertes, stats, exports, lookup.
- Anti-doublons : détection barcode/SKU/nom (fuzzy), fusion sécurisée avec logs.
- Rituels métier : checklist + actions par métier (épicerie, boulangerie, pharmacie…).
- Import fournisseur : CSV/PDF structuré, mapping lignes → produits, création auto fournisseur + alias.
- Catalogue PDF : A4 paginé, champs sélectionnables + branding (logo si dispo).
- Étiquettes PDF : génération A4 avec codes-barres/SKU et champs optionnels.
- Settings : services, (à compléter : email/password, invitations).
- Suppression de compte avec confirmations.

## Prérequis
- Node.js 18+ et npm.
- Python 3.11+ avec `pip`/`pip3`.
- PostgreSQL recommandé en production (`DATABASE_URL`), SQLite suffisant en dev.

## Variables d'environnement (dev)
Backend (dans votre shell, voir `.env.example`) :
- `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=true`.
- `FRONTEND_URL=http://localhost:5173` pour les liens d’emails.
- `DATABASE_URL=sqlite:///db.sqlite3` (optionnel, sinon SQLite par défaut).

Frontend (`frontend/.env`) :
- `VITE_API_BASE_URL=http://localhost:8000` pour pointer sur l’API locale.
- `VITE_SENTRY_DSN` (optionnel) pour activer la remontée d’erreurs front.

## Setup rapide (dev)
1. Cloner  
```bash
git clone https://github.com/Alioune4002/Inventory_tool_Plage.git
cd Inventory_tool_Plage
```
2. Backend  
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # ou .venv\Scripts\activate sous Windows
pip install -r requirements.txt
python manage.py makemigrations accounts products
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```
3. Frontend (Vite)  
```bash
cd ../frontend
npm install
npm run dev
```
Le front pointe sur `VITE_API_BASE_URL` si défini, sinon sur `http://localhost:8000` en dev et `https://inventory-tool-plage.onrender.com` en prod. `VITE_SENTRY_DSN` active l’observabilité front (optionnel).

## Endpoints principaux (extraits)
- Auth :  
  - `POST /api/auth/register/` (business_type, service_type/service_name, extra_services)  
  - `POST /api/auth/login/`  
  - `GET /api/auth/me/`  
  - `GET/POST/PATCH/DELETE /api/auth/services/`  
  - `DELETE /api/auth/delete-account/`
- Produits :  
  - `GET /api/products/?month=YYYY-MM&service=<id>`  
  - `POST /api/products/` (champs optionnels barcode/SKU/prix/DLC + entamé : container_status, pack_size, remaining_qty/fraction)  
  - `GET /api/inventory-stats/?month=YYYY-MM&service=<id>`
  - `GET /api/products/lookup/?barcode=CODE` (local + historique limité + suggestion OpenFoodFacts, options `history_limit`, `history_months`)
- Doublons :  
  - `GET /api/products/duplicates/?month=YYYY-MM&service=<id>`
  - `POST /api/products/merge/` (master_id, merge_ids)
- Rituels :  
  - `GET /api/rituals/?month=YYYY-MM&service=<id>`
- Réceptions (import fournisseur) :  
  - `POST /api/receipts/import/?service=<id>` (CSV/PDF structuré)
  - `POST /api/receipts/<id>/apply/` (decisions mapping)
- Pertes :  
  - `GET /api/losses/?month=YYYY-MM&service=<id>`  
  - `POST /api/losses/` (reason, qty, unit, product)  
  - `DELETE /api/losses/<id>/`
- Assistant IA (optionnel) :  
  - `POST /api/ai/assistant/` (AI_ENABLED/OPENAI_API_KEY). Retourne message + insights + actions en JSON strict à partir d’un contexte limité (stocks, pertes, top items).
- Entitlements / limites :  
  - `GET /api/me/org/entitlements` : plan_effective, plan_source, expires_at, subscription_status, entitlements, limits, usage, over_limit.  
  - Les endpoints bloqués pour dépassement retournent 403 avec code `LIMIT_*` et message explicite (lecture/export restent possibles).
- Alertes :  
  - `GET /api/alerts/` : stock bas + DLC/DDM proches (seuils 30/90j), pagination `limit`/`offset`.
- Export :  
  - `GET /api/exports/?from=YYYY-MM&to=YYYY-MM&service=<id|all>&mode=sealed|opened|all&format=csv|xlsx&email=<dest>&message=<txt>`
- PDF :  
  - `GET /api/catalog/pdf/?service=<id|all>&fields=...&q=...&category=...`
  - `GET /api/labels/pdf/?service=<id|all>&ids=1,2,3&fields=...`
- Divers :  
  - `GET /health/`

## Modèle / Service profiles (backend)
- Tenant : `business_type` (restaurant, bar, grocery, retail, camping_multi, other), `domain` (food/general).
- Service : `service_type` (grocery_food, bulk_food, bar, kitchen, retail_general, pharmacy_parapharmacy, other), `counting_mode` (unit/weight/volume/mixed), `features` JSON (barcode/sku/prices/dlc…).
- Produit : UOM pcs/kg/g/l/ml, `container_status` SEALED/OPENED, `pack_size/pack_uom`, `remaining_qty`, `remaining_fraction`, `is_packaged_item`. Tout est optionnel, warnings renvoyés si infos clés manquantes.
- Pertes : `LossEvent` (tenant, service, product, occurred_at, inventory_month, qty+unit, reason, note, created_by). Sont intégrées aux stats (losses_total_qty/cost et breakdown par reason).

## Frontend (Vite)
- Pages : Landing, Login/Register, Dashboard, Inventory, Products, Categories, Exports, Doublons, Rituels, Réceptions, Étiquettes, Settings, Support, Terms/Privacy.
- UI : composants réutilisables (Button/Card/Input/Badge/Toast), transitions Framer Motion, thèmes premium.
- Inventory : champs dynamiques selon domaine/service, warnings non bloquants, DLC caché si non-food, toggle entamé désactivé pour retail/pharma, mode Chrono optionnel.
- Pertes : page dédiée pour déclarer et lister les pertes mensuelles.
- Exports : déclenchement CSV/XLSX via `/api/exports` avec envoi email optionnel.
- Catalogue PDF : génération A4 paginée avec choix des champs + branding.
- Étiquettes PDF : génération A4 avec codes-barres/SKU (quota par plan).
- Assistant IA : panneau d’analyse dans le Dashboard (message, insights, actions).
- Entitlements front : hook `useEntitlements()` + bannières Essai/Fin d’essai/Limites/Impayés visibles dans AppShell/Dashboard/Settings. Les actions bloquées affichent des toasts clairs (codes LIMIT_*).

## Tests
- Backend : `cd backend && pytest`
- Frontend : `cd frontend && npm test` (vitest/RTL)

## Production deployment
- Backend : Gunicorn/Render/Heroku (Procfile fourni). Hébergé sur https://inventory-tool-plage.onrender.com. Variables clés : `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`.
- Stripe / billing : `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`, `FRONTEND_URL`, `STRIPE_PRICE_*`.
- Invitations : `INVITATIONS_SEND_EMAILS` (true/false) pour activer l’envoi d’emails via SendGrid. Si vous la passez à `false`, SendGrid n’est pas requis et les invitations peuvent rester manuelles.
- Email : `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (optionnel si les invitations sont désactivées). Le fallback logge un warning si la clé est absente.
- Assistant IA : `AI_ENABLED=true`, `OPENAI_API_KEY`, `AI_MODEL`, `AI_THROTTLE_RATE`.
- Frontend : Vercel/Netlify (build Vite). `VITE_API_BASE_URL` doit pointer vers `https://inventory-tool-plage.onrender.com`, `VITE_DEMO_MODE=false` en prod (pour désactiver AutoDemo), `VITE_STRIPE_ENABLED=true/false` pour activer les boutons checkout, et `VITE_SENTRY_DSN` pour activer Sentry (optionnel). Le script `scripts/validate.sh` vérifie la présence des env critiques et ne bloque pas si `npm test` n’existe pas.

Consultez `DEPLOYMENT.md` pour le runbook complet, les smoke tests curl (Stripe, invitations, entitlements, export, IA) et les alertes à surveiller en production.
Consultez `RUNBOOK.md` pour un guide minimal (dev/prod, commandes, smoke tests).

## Points d’attention actuels
- Appliquer les migrations avant de tester (sinon erreurs “no such column business_type”).
- Les exports “SEALED/OPENED” sont disponibles via `/api/exports` (une seule feuille).  
- Les settings (change email/password, invitations) restent à étendre si besoin.

## Commandes utiles
```bash
# backend
python manage.py makemigrations 
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
python manage.py report_duplicate_emails --csv /tmp/duplicate_emails.csv

# frontend
npm run dev
npm run build

# validations
scripts/validate.sh
```

Bon usage de StockScan !
