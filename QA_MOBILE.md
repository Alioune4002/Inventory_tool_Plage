# QA Mobile — StockScan (iOS / Android)

## Pré-requis
- App en prod ou staging
- Compte de test (plan Solo/Duo/Multi)
- Un fichier `receipt.csv` et un PDF fournisseur simple

## 1) Réceptions (upload + mapping + appliquer)
1. Ouvrir `Réceptions`
2. Ouvrir le drawer “Importer une réception”
3. Choisir un service + date + fournisseur
4. Upload CSV → vérifier:
   - mapping visible
   - lignes affichées avec quantités
   - bouton “Appliquer la réception” actif
5. Appliquer → vérifier toast “Réception appliquée”
6. Refaire avec PDF → vérifier extraction + mapping

## 2) Étiquettes (sélection + options + PDF)
1. Ouvrir `Étiquettes`
2. Ouvrir drawer “Sélection & options”
3. Rechercher un produit → Ajouter
4. Vérifier badge “Sélection actuelle”
5. Générer le PDF → vérifier téléchargement + ouverture

## 3) Accessibilité & navigation
- Le focus doit rester dans le drawer
- Touche Échap ferme le drawer
- Aucun scroll horizontal

## 4) Perf ressentie
- Ouverture drawer < 300ms
- Pas de freeze pendant upload
