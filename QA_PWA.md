# QA PWA — Test guidé iOS / Android (minute par minute)

## Pré-requis
- Front en preview (`npm run build && npm run preview`)
- iOS Safari + Android Chrome
- Connexion stable + mode avion disponible

## iOS Safari (8-10 min)
1. Ouvrir StockScan dans Safari.
2. Aller dans `Paramètres` → bloc “Installer StockScan”.
3. Vérifier le message “Partager → Sur l’écran d’accueil”.
4. Ajouter à l’écran d’accueil.
5. Lancer StockScan depuis l’icône (mode standalone).
6. Vérifier safe-area : topbar/bottom sans chevauchement.
7. Couper le réseau (mode avion) → relancer l’app.
8. Vérifier affichage offline + toast “Hors ligne”.
9. Revenir en ligne → toast “Connexion rétablie”.

## Android Chrome (8-10 min)
1. Ouvrir StockScan dans Chrome.
2. Aller dans `Paramètres` → bloc “Installer StockScan”.
3. Cliquer “Installer l’application”.
4. Vérifier prompt Android → installer.
5. Lancer depuis l’icône (mode standalone).
6. Couper le réseau → relancer l’app.
7. Vérifier affichage offline + toast.
8. Revenir en ligne → toast de reprise.
9. Déployer une nouvelle version → vérifier la bannière “Nouvelle version disponible” + bouton “Mettre à jour”.

## Points de validation
- Installation OK sur iOS/Android.
- Pas de boucle de refresh lors des updates.
- Pas de cache sur POST/PUT/DELETE.
- UI utilisable hors ligne (app shell + message).
