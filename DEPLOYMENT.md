# StockScan / Inventarium Deployment runbook

Ce document centralise ce qu’il faut pour lancer StockScan en production (Stripe, SendGrid, entitlements, IA, exports, invitations) et pour monitorer ensuite l’expérience client.

## 1. Variables d’environnement
| Nom | Description | Obligatoire ? | Exemple |
| --- | --- | --- | --- |
| `DJANGO_SECRET_KEY` | Clé Django secrète | ✅ | `dj-secret-...` |
| `DJANGO_DEBUG` | `false` en prod | ✅ | `false` |
| `DJANGO_ALLOWED_HOSTS` | Domaines autorisés | ✅ | `inventory-tool-plage.onrender.com` |
| `DATABASE_URL` | PostgreSQL | ✅ | `postgres://user:pass@host/db` |
| `CORS_ALLOWED_ORIGINS` | Front + Vercel | ✅ | `https://stockscan.app` |
| `STRIPE_API_KEY` | Clé Stripe secret | ✅ | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook | ✅ | `whsec_...` |
| `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` | Retours vers frontend | ✅ | `${FRONTEND_URL}/billing/success` |
| `STRIPE_PRICE_*` | Price ID par plan | ✅ | `price_...` |
| `FRONTEND_URL` | URL publique du front | ✅ | `https://stockscan.app` |
| `VITE_API_BASE_URL` | API backend utilisée par Vite | ✅ | `https://inventory-tool-plage.onrender.com` |
| `VITE_STRIPE_ENABLED` | Active les boutons checkout (true/false) | ✅ | `true` |
| `INVITATIONS_SEND_EMAILS` | Envoi automatique des invitations par email | ⚠️ | `true` |
| `SENDGRID_API_KEY` | Envoyeur mail (invitations) | ⚠️ | `SG....` |
| `SENDGRID_FROM_EMAIL` | Expéditeur mail | ⚠️ | `no-reply@stockscan.app` |
| `AI_ENABLED`, `OPENAI_API_KEY`, `AI_MODEL`, `AI_THROTTLE_RATE` | Assistant IA | Conditionnel (voir section IA) | `true`, `sk_...`, `gpt-4o-mini`, `10/min` |
| `VITE_DEMO_MODE` | Active AutoDemo (désactiver en prod) | ✅ | `false` |

⚠️ **SendGrid** est requis seulement si `INVITATIONS_SEND_EMAILS=true`. Si vous basculez en mode manuel (liens + tokens) ou que `INVITATIONS_SEND_EMAILS=false`, vous pouvez omettre `SENDGRID_*` et laisser des logs propres.  
`OPENAI_API_KEY` est requis uniquement si `AI_ENABLED=true`. `scripts/validate.sh` détecte ce cas et échoue sinon.

## 2. Build & validation automatisée
1. **Lint/tests/build** (CI + pré-déploiement)  
   ```bash
   scripts/validate.sh
   ```  
   - Vérifie les env obligatoires et optionnels (`SKIP_ENV_CHECK=true` pour local sans clé prod).  
   - Lance `npm run lint`, `npm run test` (si défini), `npm run build` pour le frontend.  
   - Lance `python manage.py check` + `python manage.py test` pour le backend.
2. **Backend**  
   ```bash
   cd backend && source .venv/bin/activate
   python manage.py migrate
   python manage.py collectstatic --no-input
   python manage.py check
   ```
3. **Frontend**  
   ```bash
   npm run build --prefix frontend
   ```
4. **Distribution**  
   Le `package.json` racine copie `frontend/dist/` vers `dist/`, utilisé par Vercel ou le CDN.

## 3. Routes critiques + smoke tests curl
| Route | Commande exemple | Smoke test attendu |
| --- | --- | --- |
| `POST /api/auth/register/` | `curl -X POST -H "Content-Type: application/json" -d '{"username":"client","password":"Secret123!","password_confirm":"Secret123!","email":"client@example.com","tenant_name":"Mon commerce","business_type":"restaurant","service_type":"kitchen","service_name":"Cuisine","domain":"food"}' https://inventory-tool-plage.onrender.com/api/auth/register/` | Retour 201 avec tokens + tenant/service créés. |
| `POST /api/auth/memberships/` | `curl -X POST -H "Authorization: Bearer $TOKEN" -d '{"email":"manager@example.com","role":"manager"}'` | 201 + mail SendGrid (ou log fallback) + inclusion dans `/api/auth/members/summary/`. |
| `POST /api/auth/billing/checkout/` | `curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"plan":"PRO","cycle":"MONTHLY"}' ...` | Devuelve URL Stripe; vérifie `entitlements` mis à jour (plan_effective). |
| `POST /api/auth/billing/portal/` | même header, body vide | 200 + URL Stripe valid ; ne doit pas planter quand `STRIPE_PORTAL_DISABLED=true`. |
| `POST /api/auth/billing/webhook/` | simule `invoice.payment_succeeded` (payload Stripe) | 200 et idempotence (même `event.id` traité une seule fois). |
| `GET /api/auth/me/org/entitlements` | `curl -H "Authorization: Bearer $TOKEN" ...` | JSON avec limites/usage ; `LIMIT_*` renvoie 403 si dépassement. |
| `GET /api/export-excel/?service=<id>&format=xlsx` | `curl -H "Authorization: Bearer $TOKEN" ...` | `Content-Disposition` non vide, fichier XLSX. Si quota dépassé → 403. |
| `POST /api/ai/assistant/` | `curl -X POST -H "Authorization: Bearer $TOKEN" ...` | Retour JSON strict (message/insights/actions/question) ou fallback si IA désactivée. |

## 4. Smoke tests manuels (après déploiement complet)
1. **Onboarding multi-services** : créer tenant/site, vérifier création de services, CGU, onboarding multi-services.  
2. **Invitations** : envoie+acceptation/refus, réponse 200, mail/jeton.  
3. **Stripe checkout / portal** : payer plan test, vérifier entitlements (free vs payant).  
4. **Exports Excel** : récupérer XLSX, vérifier entêtes et verrouillage (403 si `LIMIT_EXPORT`).  
5. **Entitlements/limitations** : forcer `LIMIT_*`, vérifier erreurs UI + codes.  
6. **Assistant IA** : `POST /api/ai/assistant/`, vérifier JSON strict ou fallback (pas de fails 500).  
7. **AutoDemo** : confirm `VITE_DEMO_MODE=false` en prod => pas d’API, rien n’écrit en DB (big guard). Démo non affichée hors env dédiée.

## 5. Monitoring & observabilité
- **Stripe webhook** : logs Render → vérifier `api/auth/billing/webhook/` 200/`idempotent`. Si 5xx/409 → inspecter `STRIPE_WEBHOOK_SECRET`, redis patch.  
- **SendGrid/invitations** : vérifier logs SendGrid (statut 202), surveiller `Invitation`/`Membership` pour erreur 409 (email existant). Si `SENDGRID_API_KEY` manquant, les invitations s’enregistrent mais email n’est pas envoyé (alerte).  
- **Entitlements** : surveiller `LIMIT_*` 403 dans les logs ; déclenche alignement plan/clog.  
- **Exports** : suivre `/api/export-excel/` (fichier non vide) et export 403.  
- **Assistant IA** : surveiller erreurs 500, fallback message. Si `AI_ENABLED=true` mais `OPENAI_API_KEY` invalide, on logge un warning `AI disabled`.  
- **AutoDemo** : `VITE_DEMO_MODE` doit rester `false` en prod; le front ne rendra rien sinon.

## 6. Checklist « OK pour déployer »
1. `scripts/validate.sh` réussit (lint/test/build/check) et les env requis sont visibles dans Render/Vercel.  
2. Smoke tests curl + manuels pour invitations, Stripe, entitlements, exports, IA.  
3. Logs Stripe/SendGrid/IA surveillés (alerte 5xx, 403, 409).  
4. `VITE_DEMO_MODE=false` en prod, `FRONTEND_URL`/`VITE_API_BASE_URL` alignés.  
5. Documentation à jour (`README.md`, `DEPLOYMENT.md`).  
6. Checklist visible pour la prochaine release (communication manuelle sur Slack/email).  
