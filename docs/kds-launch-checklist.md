# StockScan KDS — Checklist lancement public (gratuit)

## Positionnement & promesses
- [ ] Page /kds : mention "gratuit, sans abonnement, sans carte bancaire".
- [ ] Pas de promesse non tenue (import menu automatique, IA, etc.).
- [ ] Cible claire : service à table (restaurant, bar, food truck, etc.).

## Parcours & auth
- [ ] /kds accessible sans auth (landing).
- [ ] /kds/app protégé : redirection /login?next=/kds/app si non connecté.
- [ ] Après login, retour automatique sur /kds/app.

## Logique cuisine
- [ ] Prise de commande en salle -> statut DRAFT.
- [ ] "Envoyer en cuisine" -> statut SENT + décrément stock ingrédients.
- [ ] Stock insuffisant => 409 + rollback.
- [ ] "Prêt" -> statut READY.
- [ ] "Servi" -> statut SERVED.

## Annulation & pertes
- [ ] Annulation DRAFT sans impact stock.
- [ ] Annulation après envoi -> WasteEvent + StockConsumption WASTE.
- [ ] Raison d’annulation traçable.

## Liaison POS
- [ ] Commandes ouvertes visibles dans POS.
- [ ] Encaissement POS clôture la commande (PAID).
- [ ] Pas de double décrément stock (déjà fait à SENT).

## UX & lisibilité
- [ ] KDS lisible sur tablette (grandes cartes).
- [ ] Polling léger (2–3s) sans saccades.
- [ ] Boutons d’action clairs (Prêt / Servi / Annuler).

## PWA
- [ ] Manifest KDS distinct (nom + icône KDS).
- [ ] Ajout à l’écran d’accueil ouvre /kds/app.

## Tests manuels rapides
- [ ] Création plat + recette.
- [ ] Commande simple (1 plat).
- [ ] Commande multi-plats + notes.
- [ ] Annulation après envoi (perte générée).
- [ ] Encaissement via POS.
