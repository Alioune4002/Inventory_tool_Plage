import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import Quagga from 'quagga'; // Nouvelle bibliothèque pour le scan
import './App.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

function App() {
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({ total_value: 0, categories: [] });
  const [form, setForm] = useState({
    name: '',
    category: 'sec',
    purchase_price: '',
    selling_price: '',
    tva: '5.5',
    dlc: '',
    quantity: '',
    barcode: ''
  });
  const [editId, setEditId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [inventoryMonth, setInventoryMonth] = useState(new Date().toISOString().slice(0, 7));
  const [futureMonthMessage, setFutureMonthMessage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isQuaggaInitialized, setIsQuaggaInitialized] = useState(false);
  const [prices, setPrices] = useState({});
  const [categories, setCategories] = useState([
    { value: 'sec', label: 'Sec' },
    { value: 'frais', label: 'Frais' },
    { value: 'non_perissable', label: 'Non périssable (non alimentaire)' },
    { value: 'portants', label: 'Portants' },
    { value: 'articles_de_plage', label: 'Articles de plage' }
  ]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const barcodeInputRef = useRef(null);
  const formRef = useRef(null);
  const videoRef = useRef(null);

  const BASE_URL = process.env.NODE_ENV === 'production'
    ? 'https://inventory-tool-plage.onrender.com'
    : 'http://localhost:8000';

  const fetchPrices = useCallback(() => {
    fetch('/prices.json')
      .then(res => {
        if (!res.ok) {
          console.warn('Fichier prices.json non trouvé ou inaccessible:', res.status, res.statusText);
          return {};
        }
        return res.json();
      })
      .then(data => setPrices(data || {}))
      .catch(err => console.error('Erreur chargement prices.json:', err));
  }, []);

  const validateInventoryMonth = useCallback((month) => {
    const selectedDate = new Date(month + '-01');
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const selectedYear = selectedDate.getFullYear();
    const selectedMonthNum = selectedDate.getMonth() + 1;

    if (selectedYear > currentYear || (selectedYear === currentYear && selectedMonthNum > currentMonth)) {
      const prevMonthEndDate = new Date(currentYear, currentMonth, 0);
      const prevMonthEnd = prevMonthEndDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
      const selectedMonthName = selectedDate.toLocaleDateString('fr-FR', { month: 'long' });
      setFutureMonthMessage(`Attention, vous ne devez pas entamer l'inventaire du mois de ${selectedMonthName} avant le ${prevMonthEnd}.`);
    } else {
      setFutureMonthMessage('');
    }
  }, []);

  const fetchProducts = useCallback(() => {
    axios.get(`${BASE_URL}/api/products/?month=${selectedMonth}`)
      .then(res => {
        console.log('Produits récupérés:', res.data);
        if (Array.isArray(res.data)) {
          setProducts(res.data);
        } else {
          console.error('La réponse API n’est pas un tableau:', res.data);
          setProducts([]);
        }
      })
      .catch(err => {
        console.error('Erreur fetch produits:', err.response ? err.response.data : err.message);
        alert('Erreur de connexion au backend. Vérifiez que le serveur est en marche et accessible via ngrok.');
        setProducts([]);
      });
  }, [selectedMonth, BASE_URL]);

  const fetchStats = useCallback(() => {
    axios.get(`${BASE_URL}/api/inventory-stats/?month=${selectedMonth}`)
      .then(res => {
        console.log('Stats récupérées:', res.data);
        setStats(res.data);
      })
      .catch(err => console.error('Erreur fetch stats:', err));
  }, [selectedMonth, BASE_URL]);

  useEffect(() => {
    fetchPrices();
    fetchProducts();
    fetchStats();
    validateInventoryMonth(inventoryMonth);
  }, [fetchPrices, fetchProducts, fetchStats, validateInventoryMonth, selectedMonth, inventoryMonth]);

  const startScanning = useCallback(async () => {
    if (!videoRef.current) {
      console.error('Erreur : videoRef n\'est pas initialisé');
      setIsScanning(false);
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia non supporté par ce navigateur');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      Quagga.init({
        inputStream: {
          type: 'LiveStream',
          target: videoRef.current,
          constraints: {
            facingMode: 'environment',
            width: { min: 640 },
            height: { min: 480 }
          }
        },
        decoder: {
          readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'upc_reader', 'upc_e_reader']
        }
      }, (err) => {
        if (err) {
          console.error('Erreur initialisation Quagga:', err);
          alert(`Erreur caméra : ${err.message}. Vérifiez les permissions et utilisez Chrome/Safari récent.`);
          setIsScanning(false);
          return;
        }
        setIsQuaggaInitialized(true);
        Quagga.start();
      });

      Quagga.onDetected((data) => {
        if (data && data.codeResult && data.codeResult.code) {
          console.log('Code-barres détecté:', data.codeResult.code);
          setIsScanning(false);
          handleBarcodeInput(data.codeResult.code);
          try {
            new Audio('/beep-short.mp3').play().catch(err => console.error('Erreur audio:', err));
          } catch (err) {
            console.error('Erreur lecture audio:', err);
          }
        }
      });
    } catch (error) {
      console.error('Erreur démarrage scanner:', error);
      alert(`Erreur caméra : ${error.message}. Vérifiez HTTPS, permissions caméra, et utilisez Chrome/Safari récent.`);
      setIsScanning(false);
    }
  }, []);

  const stopScanning = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (isQuaggaInitialized && typeof Quagga !== 'undefined' && Quagga) {
      Quagga.stop();
      setIsQuaggaInitialized(false);
    }
  }, [isQuaggaInitialized]);

  const handleScanToggle = () => {
    if (isScanning) {
      stopScanning();
      setIsScanning(false);
    } else {
      setIsScanning(true);
      startScanning();
    }
    if (!isScanning) focusBarcodeInput();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form, inventory_month: inventoryMonth };
    if (!data.tva) delete data.tva;
    if (!data.dlc || data.category === 'non_perissable') delete data.dlc;
    if (!data.barcode) delete data.barcode;

    if (editId) {
      axios.put(`${BASE_URL}/api/products/${editId}/`, data)
        .then(() => {
          fetchProducts();
          fetchStats();
          resetForm();
          focusBarcodeInput();
        })
        .catch(err => {
          console.error('Erreur mise à jour produit:', err);
          if (err.response && err.response.status === 400) {
            alert('Erreur : Ce code-barres est déjà utilisé par un autre produit.');
          }
        });
    } else {
      axios.post(`${BASE_URL}/api/products/`, data)
        .then(() => {
          fetchProducts();
          fetchStats();
          resetForm();
          focusBarcodeInput();
        })
        .catch(err => {
          console.error('Erreur ajout produit:', err);
          if (err.response && err.response.status === 400) {
            alert('Erreur : Ce code-barres est déjà utilisé par un autre produit.');
          }
        });
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      category: 'sec',
      purchase_price: '',
      selling_price: '',
      tva: '5.5',
      dlc: '',
      quantity: '',
      barcode: ''
    });
    setEditId(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'category' && value === 'add_new') {
      const newCategory = prompt('Entrez le nom de la nouvelle catégorie :');
      if (newCategory && !categories.some(cat => cat.value === newCategory.toLowerCase())) {
        const newCat = { value: newCategory.toLowerCase(), label: newCategory };
        setCategories([...categories, newCat]);
        setForm({ ...form, category: newCat.value });
        setIsCategoryOpen(false);
      }
    } else {
      const newForm = { ...form, [name]: value };
      if (name === 'category') {
        if (value === 'portants' || value === 'articles_de_plage') {
          newForm.tva = '20';
        } else if (form.tva === '20') {
          newForm.tva = '5.5';
        }
      }
      setForm(newForm);
    }
  };

  const handleEdit = (product) => {
    setForm({
      name: product.name,
      category: product.category,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      tva: product.tva || '5.5',
      dlc: product.dlc || '',
      quantity: product.quantity,
      barcode: product.barcode || ''
    });
    setEditId(product.id);
    setInventoryMonth(product.inventory_month || new Date().toISOString().slice(0, 7));
    formRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce produit ?')) {
      axios.delete(`${BASE_URL}/api/products/${id}/`)
        .then(() => {
          fetchProducts();
          fetchStats();
        })
        .catch(err => console.error('Erreur suppression produit:', err));
    }
  };

  const handleExportExcel = () => {
    window.location.href = `${BASE_URL}/api/export-excel/?month=${selectedMonth}`;
  };

  const fetchProductInfoFromOpenFoodFacts = async (barcode) => {
    try {
      const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      if (response.data.status === 1) {
        const product = response.data.product;
        const name = product.product_name || '';
        let category = 'sec';
        let tva = '5.5';

        const categories = product.categories_tags || [];
        if (categories.some(tag => tag.includes('dairy') || tag.includes('meat') || tag.includes('fish') || tag.includes('fresh'))) {
          category = 'frais';
        } else if (categories.some(tag => tag.includes('canned') || tag.includes('sauces') || tag.includes('spreads'))) {
          category = 'non_perissable';
        } else if (categories.some(tag => tag.includes('cereals') || tag.includes('pasta') || tag.includes('beverages'))) {
          category = 'sec';
        } else if (categories.some(tag => tag.includes('clothing') || tag.includes('textiles'))) {
          category = 'portants';
        } else if (categories.some(tag => tag.includes('beach') || tag.includes('outdoor') || tag.includes('recreational'))) {
          category = 'articles_de_plage';
        }

        if (categories.some(tag => tag.includes('non-food-products'))) {
          tva = '20';
        } else if (categories.some(tag => tag.includes('restaurant') || tag.includes('prepared-meals'))) {
          tva = '10';
        }

        return { name, category, tva };
      }
      return { name: '', category: 'sec', tva: '5.5' };
    } catch (error) {
      console.error('Erreur Open Food Facts:', error);
      return { name: '', category: 'sec', tva: '5.5' };
    }
  };

  const handleBarcodeInput = async (scannedBarcode) => {
    const product = products.find(p => p.barcode === scannedBarcode && p.inventory_month === inventoryMonth);
    if (product) {
      handleEdit(product);
    } else {
      let productName = '';
      let purchasePrice = '';
      let category = 'sec';
      let tva = '5.5';

      if (prices[scannedBarcode]) {
        productName = prices[scannedBarcode].name || '';
        purchasePrice = prices[scannedBarcode].purchase_price || '';
        category = prices[scannedBarcode].category || 'sec';
        tva = prices[scannedBarcode].tva || '5.5';
      }

      if (!productName) {
        const openFoodData = await fetchProductInfoFromOpenFoodFacts(scannedBarcode);
        productName = openFoodData.name;
        category = openFoodData.category;
        tva = openFoodData.tva;
      }

      setForm({
        name: productName,
        category: category,
        purchase_price: purchasePrice,
        selling_price: '',
        tva: category === 'portants' || category === 'articles_de_plage' ? '20' : tva,
        dlc: '',
        quantity: '',
        barcode: scannedBarcode
      });
      setEditId(null);
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    setBarcodeSearch('');
  };

  const handleBarcodeSearch = async (e) => {
    if (e.key === 'Enter' && barcodeSearch) {
      await handleBarcodeInput(barcodeSearch);
      try {
        new Audio('/beep-short.mp3').play().catch(err => console.error('Erreur audio:', err));
      } catch (err) {
        console.error('Erreur lecture audio:', err);
      }
    }
  };

  const focusBarcodeInput = () => {
    barcodeInputRef.current.focus();
  };

  const handleDeleteCategory = (value) => {
    if (categories.length > 1) {
      setCategories(categories.filter(cat => cat.value !== value));
      if (form.category === value) {
        setForm({ ...form, category: categories[0].value });
      }
      setIsCategoryOpen(false);
    }
  };

  const handleModifyCategory = (oldValue) => {
    const newValue = prompt(`Modifier ${categories.find(cat => cat.value === oldValue).label} en :`, categories.find(cat => cat.value === oldValue).label);
    if (newValue && !categories.some(cat => cat.value === newValue.toLowerCase()) && categories.some(cat => cat.value === oldValue)) {
      setCategories(categories.map(cat => 
        cat.value === oldValue ? { value: newValue.toLowerCase(), label: newValue } : cat
      ));
      if (form.category === oldValue) {
        setForm({ ...form, category: newValue.toLowerCase() });
      }
      setIsCategoryOpen(false);
    }
  };

  const filteredProducts = Array.isArray(products) ? products.filter(product => {
    const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }) : [];

  const categoriesForSelect = categories.map(cat => cat.value);

  const groupedProducts = categoriesForSelect.reduce((acc, cat) => {
    acc[cat] = filteredProducts.filter(p => p.category === cat && p.inventory_month === selectedMonth);
    return acc;
  }, {});

  const barChartData = {
    labels: stats.categories.map(cat => cat.category),
    datasets: [
      {
        label: 'Valeur d’achat (€)',
        data: stats.categories.map(cat => (cat.total_purchase_value || 0).toFixed(2)),
        backgroundColor: 'rgba(0, 123, 255, 0.5)',
        borderColor: 'rgba(0, 123, 255, 1)',
        borderWidth: 1
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top'
      },
      title: {
        display: true,
        text: 'Valeur du stock par catégorie'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Valeur (€)'
        }
      }
    }
  };

  const pieChartData = {
    labels: stats.categories.map(cat => cat.category),
    datasets: [
      {
        label: 'Quantité',
        data: stats.categories.map(cat => (cat.total_quantity || 0).toFixed(0)),
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(153, 102, 255, 0.7)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1
      }
    ]
  };

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top'
      },
      title: {
        display: true,
        text: 'Répartition des quantités par catégorie'
      }
    }
  };

  return (
    <div className="container">
      <h1>Inventaire Épicerie</h1>
      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Nom du produit</label>
          <input
            type="text"
            name="name"
            id="name"
            placeholder="ex. : Coca-Cola"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group category-group">
          <label htmlFor="category">Catégorie</label>
          <div className="custom-select" onClick={() => setIsCategoryOpen(!isCategoryOpen)}>
            <div className="selected-option">{categories.find(cat => cat.value === form.category)?.label || 'Sélectionner'}</div>
            {isCategoryOpen && (
              <div className="options">
                {categories.map(cat => (
                  <div
                    key={cat.value}
                    className="option"
                    onClick={() => {
                      setForm({ ...form, category: cat.value });
                      setIsCategoryOpen(false);
                    }}
                  >
                    <span>{cat.label}</span>
                    <div className="option-actions">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleModifyCategory(cat.value);
                        }}
                        title="Modifier"
                      >
                        <i className="fas fa-pen"></i>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(cat.value);
                        }}
                        title="Supprimer"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
                <div
                  className="option add-option"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newCategory = prompt('Entrez le nom de la nouvelle catégorie :');
                    if (newCategory && !categories.some(cat => cat.value === newCategory.toLowerCase())) {
                      const newCat = { value: newCategory.toLowerCase(), label: newCategory };
                      setCategories([...categories, newCat]);
                      setForm({ ...form, category: newCat.value });
                      setIsCategoryOpen(false);
                    }
                  }}
                >
                  + Ajouter une catégorie
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="purchase_price">Prix d'achat (€)</label>
          <input
            type="number"
            name="purchase_price"
            id="purchase_price"
            placeholder="ex. : 0.50"
            value={form.purchase_price}
            onChange={handleChange}
            step="0.01"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="selling_price">Prix de vente (€)</label>
          <input
            type="number"
            name="selling_price"
            id="selling_price"
            placeholder="ex. : 1.00"
            value={form.selling_price}
            onChange={handleChange}
            step="0.01"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="tva">TVA (%)</label>
          <select name="tva" id="tva" value={form.tva} onChange={handleChange}>
            <option value="5.5">5.5 %</option>
            <option value="10">10 %</option>
            <option value="20">20 %</option>
          </select>
        </div>
        {form.category !== 'non_perissable' && (
          <div className="form-group">
            <label htmlFor="dlc">Date de péremption (DLC)</label>
            <input
              type="date"
              name="dlc"
              id="dlc"
              placeholder="ex. : 2025-12-31"
              value={form.dlc}
              onChange={handleChange}
              className="dlc-input"
            />
          </div>
        )}
        <div className="form-group">
          <label htmlFor="quantity">Quantité</label>
          <input
            type="number"
            name="quantity"
            id="quantity"
            placeholder="ex. : 10"
            value={form.quantity}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="barcode">Code-barres</label>
          <input
            type="tel"
            name="barcode"
            id="barcode"
            placeholder="ex. : 5449000000996"
            value={form.barcode}
            onChange={handleChange}
            pattern="[0-9]*"
            inputMode="numeric"
          />
        </div>
        <div className="form-group">
          <label htmlFor="inventoryMonth">Mois d'inventaire</label>
          <input
            type="month"
            name="inventoryMonth"
            id="inventoryMonth"
            value={inventoryMonth}
            onChange={(e) => {
              setInventoryMonth(e.target.value);
              validateInventoryMonth(e.target.value);
            }}
          />
          {futureMonthMessage && (
            <p style={{ color: 'orange' }}>{futureMonthMessage}</p>
          )}
        </div>
        <div className="form-buttons">
          <button type="submit">
            <i className="fas fa-plus"></i> {editId ? 'Modifier' : 'Ajouter'}
          </button>
          {editId && (
            <button type="button" onClick={resetForm}>
              <i className="fas fa-times"></i> Annuler
            </button>
          )}
        </div>
      </form>
      <div className="filter">
        <label>Filtrer par mois : </label>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
        />
        <label>Catégorie : </label>
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
        >
          <option value="">Toutes</option>
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
        <label>Rechercher : </label>
        <input
          type="text"
          placeholder="Nom du produit"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <label>Code-barres : </label>
        <input
          ref={barcodeInputRef}
          type="tel"
          placeholder="Scanner ou entrer code-barres"
          value={barcodeSearch}
          onChange={e => setBarcodeSearch(e.target.value)}
          onKeyPress={handleBarcodeSearch}
          pattern="[0-9]*"
          inputMode="numeric"
          autoFocus
        />
        <button onClick={handleScanToggle}>
          <i className="fas fa-camera"></i> {isScanning ? 'Arrêter Scan' : 'Scanner'}
        </button>
        <button onClick={handleExportExcel}>
          <i className="fas fa-file-excel"></i> Exporter Excel
        </button>
      </div>
      {isScanning && (
        <div className="scanner">
          <video ref={videoRef} style={{ width: '300px', height: '300px' }} />
        </div>
      )}
      {categoriesForSelect.map(category => (
        groupedProducts[category].length > 0 && (
          <div key={category}>
            <h2>{categories.find(cat => cat.value === category).label}</h2>
            <table className="table-responsive">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Catégorie</th>
                  <th>Prix d'achat</th>
                  <th>Prix de vente</th>
                  <th>TVA (%)</th>
                  <th>DLC</th>
                  <th>Quantité</th>
                  <th>Code-barres</th>
                  <th>Mois</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedProducts[category].map(product => (
                  <tr key={product.id}>
                    <td title={product.name}>{product.name.length > 15 ? product.name.slice(0, 15) + '...' : product.name}</td>
                    <td title={categories.find(cat => cat.value === product.category).label}>{categories.find(cat => cat.value === product.category).label.length > 15 ? categories.find(cat => cat.value === product.category).label.slice(0, 15) + '...' : categories.find(cat => cat.value === product.category).label}</td>
                    <td>{product.purchase_price} €</td>
                    <td>{product.selling_price} €</td>
                    <td>{product.tva || '-'}</td>
                    <td title={product.dlc}>{product.dlc && product.dlc.length > 10 ? product.dlc.slice(0, 10) + '...' : product.dlc || '-'}</td>
                    <td>{product.quantity}</td>
                    <td>{product.barcode || '-'}</td>
                    <td>{product.inventory_month}</td>
                    <td>
                      <button onClick={() => handleEdit(product)}>
                        <i className="fas fa-pen"></i> Modifier
                      </button>
                      <button onClick={() => handleDelete(product.id)}>
                        <i className="fas fa-trash"></i> Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ))}
      <div className="dashboard">
        <h2>Statistiques</h2>
        <div className="charts-grid">
          <div className="chart-container">
            <Bar data={barChartData} options={barChartOptions} />
          </div>
          <div className="chart-container">
            <Pie data={pieChartData} options={pieChartOptions} />
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <h3>Valeur totale du stock</h3>
            <p>{(stats.total_value || 0).toFixed(2)} €</p>
          </div>
          {stats.categories.map(cat => (
            <div className="stat-card" key={cat.category}>
              <h3>{categories.find(c => c.value === cat.category).label}</h3>
              <p>Quantité : {cat.total_quantity || 0}</p>
              <p>Valeur achat : {(cat.total_purchase_value || 0).toFixed(2)} €</p>
              <p>Valeur vente : {(cat.total_selling_value || 0).toFixed(2)} €</p>
              <p>Marge moyenne : {(cat.avg_margin || 0).toFixed(2)} €</p>
            </div>
          ))}
        </div>
      </div>
      <footer style={{ marginTop: '20px', textAlign: 'center', fontSize: '10px', color: '#999' }}>
        By Alioune.              © 2025 Inventaire Épicerie La Plage.
      </footer>
    </div>
  );
}

export default App;