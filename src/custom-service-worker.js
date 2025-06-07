// Importe le Service Worker généré par Workbox
     workbox.core.skipWaiting();
     workbox.core.clientsClaim();

     // Ajoute la logique de synchronisation
     self.addEventListener('sync', (event) => { // eslint-disable-line no-restricted-globals
       if (event.tag === 'sync-products') {
         event.waitUntil(syncProducts());
       }
     });

     async function syncProducts() {
       const db = await openDB();
       const products = await db.getAll('pending-products');
       for (const product of products) {
         try {
           await fetch('https://inventory-tool-plage.onrender.com/api/products/', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(product),
           });
           await removePendingProduct(product.id);
         } catch (error) {
           console.error('Erreur synchronisation produit:', error);
         }
       }
     }

     async function getPendingProducts(db) {
       return await db.getAll('pending-products');
     }

     async function removePendingProduct(id) {
       const db = await openDB();
       await db.delete('pending-products', id);
     }

     async function openDB() {
       return new Promise((resolve, reject) => {
         const request = indexedDB.open('inventoryDB', 1);
         request.onupgradeneeded = (event) => {
           const db = event.target.result;
           db.createObjectStore('pending-products', { keyPath: 'id' });
         };
         request.onsuccess = (event) => resolve(event.target.result);
         request.onerror = (event) => reject(event.target.error);
       });
     }