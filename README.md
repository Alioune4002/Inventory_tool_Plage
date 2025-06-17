# 🏖️ Inventarium Épicerie La Plage 📋

Bienvenue dans **Inventarium Épicerie La Plage**, une application web d’inventaire conçue pour gérer les stocks d’une épicerie dans un camping ! 🌴 Cette application permet de scanner des codes-barres, suivre les produits, et exporter les données en Excel. 🎉

---

## 🚀 Présentation du projet

Ce projet a été créé pour répondre au besoin d’une gestion efficace des stocks dans une épicerie de camping, avec des produits variés (boissons, aliments frais, articles de plage, etc.). 🌊 Il inclut un scanner QR/code-barres, des statistiques visuelles, et une interface intuitive pour les utilisateurs. 🖥️

### 🎯 Contexte
- Développé pour une épicerie saisonnière dans un camping.
- Objectif : Simplifier l’inventaire mensuel et optimiser la gestion des produits périssables ou non.
- Inspiré par un besoin réel d’organisation en environnement estival ! ☀️

---

## 🛠️ Technologies utilisées

- **Frontend** : 
  - [React](https://reactjs.org/) ⚛️ pour une interface dynamique.
  - [Chart.js](https://www.chartjs.org/) 📊 pour les graphiques (barres et camemberts).
  - [html5-qrcode](https://github.com/mebjas/html5-qrcode) 📷 pour le scanner de codes-barres.
- **Backend** : 
  - [Django](https://www.djangoproject.com/) 🐍 avec une API REST pour gérer les produits et les stats.
  - Base de données SQLite pour stocker les données localement.
- **Déploiement** : 
  - [Vercel](https://vercel.com/) 🚀 pour héberger l’application.
- **Fonctionnalités** : Export Excel via une API personnalisée. 📥

---

## 🌟 Fonctionnalités principales

- 📋 Ajout/Modification/Suppression de produits avec nom, catégorie, prix, TVA, DLC, quantité, et code-barres.
- 🔍 Scanner de codes-barres avec intégration Open Food Facts pour les détails produits.
- 📊 Statistiques visuelles : valeur du stock et répartition par catégorie.
- 📅 Gestion par mois d’inventaire avec validation des dates futures.
- 💾 Export des données en fichier Excel.
- 🌐 Interface responsive pour ordinateur, iPad, et mobile (iPhone après ajustements).

---

## ⚠️ Challenges rencontrés

Ce projet a été une aventure technique avec plusieurs obstacles :  
- 🛑 **Service Worker** : Problèmes d’importation résolus en supprimant les références inutiles.
- 💾 **OneDrive** : Erreurs `EPERM` sur Windows corrigées en déplaçant le projet vers `C:\Projects\`.
- 🔄 **Git Conflicts** : Gestion de merges complexes due à des divergences avec `origin/master`.
- 🌐 **Déploiement Vercel** : Erreur 401 sur `manifest.json` résolue en ajustant l’authentification.
- 📱 **Compatibilité mobile** : Page blanche sur iPhone 13 fixée après vidage de cache et reconfiguration.

Chaque défi a été surmonté avec patience et des ajustements itératifs ! 💪

---

## 📦 Installation

1. Clone le dépôt :  
   ```bash
   git clone https://github.com/Alioune4002/Inventory_tool_Plage.git
   cd Inventory_tool_Plage

2. Installe les dépendances (dans frontend) :
cd frontend
npm install

3. Configure le backend (dans backend) :
 - Installe les dépendances Python :
pip install -r requirements.txt

 - Applique les migrations :
python manage.py migrate

4. Lance le projet :
   - Backend :
python manage.py runserver

 - Frontend :
npm start

5. Déploie sur Vercel (optionnel) :
vercel deploy --prod

🎉 Déploiement
L’application est hébergée sur Vercel. Teste-la et donne-moi tes retours ! 👇

🤝 Contribution
 - Ouvre une issue pour signaler des bugs ou proposer des idées. 🐛
 - Fais un fork et une pull request pour contribuer ! 🌟

Made with ❤️ by Alioune. © 2025 Inventaire Épicerie La Plage.
