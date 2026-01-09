# Admin dashboard interne (StockScan)

Ce document décrit l’API interne destinée au suivi des comptes et des usages.  
Accès strict **staff-only** côté backend.

## Sécurité
- Auth JWT obligatoire sur tous les endpoints `/api/admin/*` (sauf `track-visit`).
- Permission: `IsAdminUser` (utilisateur `is_staff=True`).
- Aucune donnée visible côté public.

## Endpoints

### 1) Tracking visites (public, sans auth)
```
POST /api/admin/track-visit/
```
Payload:
```
{ "page": "landing" | "pos" | "kds" }
```
Utilisé pour comptabiliser les visites des landings publiques.
Protections:
- Throttle par IP (défaut `20/min`, configurable via `ADMIN_VISIT_THROTTLE_RATE`).
- Déduplication 10 minutes par `{ip_hash, ua_hash, page}`.
- IP et user-agent stockés uniquement sous forme de hash (pas de données en clair).

### 2) Liste utilisateurs (staff)
```
GET /api/admin/users/
```
Filtres query params:
- `email` (contient)
- `is_active` (`true|false`)
- `is_test_account` (`true|false`)
- `deleted` (`true|false`)

Retour:
- email, date_joined, last_login
- modules actifs (StockScan/POS/KDS)
- type de service (premier service du tenant)
- flag compte test, statut actif, soft delete

### 3) Désactiver un compte (staff)
```
POST /api/admin/users/<id>/disable/
```
Effet: `user.is_active = False`.

### 4) Soft delete (staff)
```
POST /api/admin/users/<id>/soft-delete/
```
Effet: `user.is_active = False` + `profile.deleted_at = now`.
Note: la suppression "hard" n'est pas exposée pour éviter les effets de bord sur les données métiers.

### 5) Marquer compte test (staff)
```
POST /api/admin/users/<id>/set-test/
```
Payload:
```
{ "is_test_account": true|false }
```

### 6) Statistiques simples (staff)
```
GET /api/admin/stats/
```
Retour:
- inscriptions par jour (30 derniers jours)
- visites /, /pos, /kds (totaux 30j)
- activations POS/KDS (tenants ayant des tickets / commandes)

## Paramétrage / Utilisation
- Pour accéder aux endpoints, l’utilisateur doit avoir `is_staff=True`.
- Le flag compte test est stocké dans `accounts.UserProfile.is_test_account`.

## Notes techniques
- Les métriques de visites sont stockées dans `AdminDailyMetric`.
- Aucun stockage de données personnelles côté tracking public.
- Compat: l’ancienne clé `visit_root` (legacy) reste compatible avec les stats.
