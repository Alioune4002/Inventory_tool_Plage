# StockScan POS — Checklist lancement public (gratuit)

## Positionnement & promesses
- [ ] Page /pos : mention "100% gratuit, sans abonnement, sans carte bancaire".
- [ ] Mention claire "non certifié fiscalement".
- [ ] Pas de promesse non tenue (export comptable avancé, certification, etc.).

## Parcours & auth
- [ ] /pos accessible sans auth (landing).
- [ ] /pos/app protégé : redirection /login?next=/pos/app si non connecté.
- [ ] Après login, retour automatique sur /pos/app.

## Encaissement & stock
- [ ] Stock décrémenté uniquement à l’encaissement final.
- [ ] Stock insuffisant => 409, aucun ticket créé.
- [ ] Montant paiements = total net (tolérance 0,01).

## Annulation / remboursement
- [ ] Annulation possible depuis l’historique.
- [ ] Raison obligatoire (liste + champ libre si "autre").
- [ ] Choix : réintégrer stock (revendable) OU créer une perte.
- [ ] Ticket passe en statut VOID + événement journalisé.

## Ticket client
- [ ] Ticket lisible (numéro, date, lignes, total, paiements).
- [ ] Impression navigateur OK (window.print).
- [ ] Historique consultable.

## Session de caisse
- [ ] Session ouverte automatiquement au premier encaissement.
- [ ] Résumé : total net, remises, paiements par méthode.
- [ ] Bouton "Clôturer la caisse" -> session fermée + résumé conservé.

## KDS ↔ POS
- [ ] Tables ouvertes visibles dans POS si module KDS actif.
- [ ] Encaissement KDS remplit panier POS sans ressaisie.
- [ ] Encaissement KDS ne re-décrémente pas le stock.

## UX & accessibilité
- [ ] Boutons ≥ 44px sur mobile/tablette.
- [ ] Messages d’erreur clairs et actionnables.
- [ ] Scanner USB/lecteur : ajout rapide via Enter.

## PWA
- [ ] Manifest POS distinct (nom + icône POS).
- [ ] Ajout à l’écran d’accueil ouvre /pos/app.

## Tests manuels rapides
- [ ] Vente simple (1 produit, 1 paiement).
- [ ] Vente multi-paiements.
- [ ] Annulation avec réintégration stock.
- [ ] Annulation avec perte (stock inchangé).
- [ ] Clôture de caisse.
