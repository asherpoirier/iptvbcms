import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft, Plus, Edit, Trash2, X, Save, Package, ChevronUp, ChevronDown, Tv, Users } from 'lucide-react';
import { getPanelGradient, getPanelColor } from '../utils/panelColors';

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showResellerModal, setShowResellerModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Filters for list view
  const [searchQuery, setSearchQuery] = useState('');
  const [panelFilter, setPanelFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  
  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const response = await adminAPI.getProducts();
      return response.data;
    },
  });

  // Fetch settings to get panel names
  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const response = await adminAPI.getSettings();
      return response.data;
    },
  });

  const xtreamPanels = settings?.xtream?.panels || [];
  const xuionePanels = settings?.xuione?.panels || [];
  
  // Combine both panel types with a type indicator
  const allPanels = [
    ...xtreamPanels.map((panel, index) => ({ ...panel, type: 'xtream', originalIndex: index })),
    ...xuionePanels.map((panel, index) => ({ ...panel, type: 'xuione', originalIndex: index }))
  ];
  
  // For components that need just XtreamUI panels (like ResellerPackageModal)
  const panels = xtreamPanels;
  
  const getPanelName = (panelIndex, panelType = 'xtream') => {
    if (panelIndex === undefined || panelIndex === null) return 'Default Panel';
    
    if (panelType === 'xuione') {
      return xuionePanels[panelIndex]?.name || `XuiOne Panel ${panelIndex}`;
    }
    return xtreamPanels[panelIndex]?.name || `Panel ${panelIndex}`;
  };

  // Group products by panel (using both panel_type and panel_index)
  const productsByPanel = React.useMemo(() => {
    if (!products) return {};
    
    const grouped = {};
    products.forEach(product => {
      const panelType = product.panel_type || 'xtream';
      const panelIndex = product.panel_index ?? 0;
      const panelKey = `${panelType}-${panelIndex}`;
      
      if (!grouped[panelKey]) {
        grouped[panelKey] = [];
      }
      grouped[panelKey].push(product);
    });
    
    return grouped;
  }, [products]);

  const handleAddNew = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    
    // Check if it's a reseller product
    if (product.account_type === 'reseller') {
      setShowResellerModal(true);  // Show reseller modal
    } else {
      setShowModal(true);  // Show subscriber modal
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setShowResellerModal(false);
    setEditingProduct(null);
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => adminAPI.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-products']);
      alert('Product deleted successfully!');
    },
  });

  const handleDelete = (product) => {
    if (window.confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(product.id);
    }
  };

  const reorderMutation = useMutation({
    mutationFn: ({ id, direction }) => adminAPI.reorderProduct(id, direction),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-products']);
    },
  });

  const handleReorder = (product, direction) => {
    reorderMutation.mutate({ id: product.id, direction });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <header className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link to="/admin" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manage Products</h1>
          
          {/* Add New Product Buttons */}
          <div className="flex gap-3">
            <button
              onClick={async () => {
                if (window.confirm('Fix display order for all products? This will reorganize products into sequential order within each panel.')) {
                  try {
                    await adminAPI.fixProductDisplayOrder();
                    alert('Display order fixed! Products have been reorganized.');
                    queryClient.invalidateQueries(['admin-products']);
                  } catch (error) {
                    alert('Failed to fix display order: ' + (error.response?.data?.detail || error.message));
                  }
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              Fix Order
            </button>
            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Subscriber Package
            </button>
            <button
              onClick={() => setShowResellerModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-5 h-5" />
              Add Reseller Package
            </button>
          </div>
        </div>

        {/* Reseller Package Modal */}
        {showResellerModal && (
          <ResellerPackageModal
            onClose={() => {
              setShowResellerModal(false);
              setEditingProduct(null);
            }}
            onSuccess={() => {
              setShowResellerModal(false);
              setEditingProduct(null);
              queryClient.invalidateQueries(['admin-products']);
            }}
            panels={allPanels}
            xtreamPanels={xtreamPanels}
            xuionePanels={xuionePanels}
            editingProduct={editingProduct}
          />
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {/* Filters for List View */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
              <div className="grid md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Search
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or description..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                
                {/* Panel Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Panel
                  </label>
                  <select
                    value={panelFilter}
                    onChange={(e) => setPanelFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Panels</option>
                    {allPanels.map((panel, idx) => (
                      <option key={idx} value={`${panel.type}-${panel.originalIndex}`}>
                        {panel.name || `${panel.type === 'xuione' ? 'XuiOne' : 'XtreamUI'} Panel ${panel.originalIndex + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Product Type
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Types</option>
                    <option value="subscriber">Subscriber</option>
                    <option value="reseller">Reseller</option>
                  </select>
                </div>
              </div>
              
              {/* Active Filters Summary */}
              {(searchQuery || panelFilter !== 'all' || typeFilter !== 'all') && (
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {products?.filter(p => {
                      const matchesSearch = !searchQuery || 
                        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
                      const matchesPanel = panelFilter === 'all' || 
                        `${p.panel_type || 'xtream'}-${p.panel_index ?? 0}` === panelFilter;
                      const matchesType = typeFilter === 'all' || p.account_type === typeFilter;
                      return matchesSearch && matchesPanel && matchesType;
                    }).length || 0} products found
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setPanelFilter('all');
                      setTypeFilter('all');
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
            
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Panel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Pricing</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {products
                    ?.filter(product => {
                      // Apply search filter
                      const matchesSearch = !searchQuery || 
                        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        product.description?.toLowerCase().includes(searchQuery.toLowerCase());
                      
                      // Apply panel filter
                      const productPanelKey = `${product.panel_type || 'xtream'}-${product.panel_index ?? 0}`;
                      const matchesPanel = panelFilter === 'all' || productPanelKey === panelFilter;
                      
                      // Apply type filter
                      const matchesType = typeFilter === 'all' || product.account_type === typeFilter;
                      
                      return matchesSearch && matchesPanel && matchesType;
                    })
                    .sort((a, b) => {
                      // Sort by panel type first (xtream before xuione)
                      const typeA = a.panel_type || 'xtream';
                      const typeB = b.panel_type || 'xtream';
                      if (typeA !== typeB) {
                        return typeA === 'xtream' ? -1 : 1;
                      }
                      // Then by panel_index
                      const panelDiff = (a.panel_index || 0) - (b.panel_index || 0);
                      if (panelDiff !== 0) return panelDiff;
                      // Then by display_order
                      return (a.display_order || 0) - (b.display_order || 0);
                    })
                    .map((product, index, array) => (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      {/* Sort Order Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleReorder(product, 'up')}
                            disabled={index === 0}
                            className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                              index === 0 ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title="Move Up"
                          >
                            <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleReorder(product, 'down')}
                            disabled={index === array.length - 1}
                            className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                              index === array.length - 1 ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title="Move Down"
                          >
                            <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                        </div>
                      </td>
                      {/* Product Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{product.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          product.account_type === 'reseller'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {product.account_type === 'reseller' ? 'Reseller' : 'Subscriber'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {getPanelName(product.panel_index || 0, product.panel_type || 'xtream')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {product.account_type === 'reseller' ? (
                          <div>{product.reseller_credits} credits</div>
                        ) : (
                          <div>{product.max_connections} connection{product.max_connections > 1 ? 's' : ''}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {product.prices && Object.entries(product.prices).map(([term, price]) => (
                          <div key={term} className="whitespace-nowrap">
                            {product.account_type === 'reseller' ? 'Lifetime' : `${term}mo`}: ${price}
                          </div>
                        ))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          product.active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {product.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(product)}
                          className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete ${product.name}?`)) {
                              deleteMutation.mutate(product.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}
      </main>

      {/* Product Form Modal */}
      {showModal && (
        <ProductFormModal
          product={editingProduct}
          onClose={handleCloseModal}
          onSuccess={() => {
            queryClient.invalidateQueries(['admin-products']);
            handleCloseModal();
          }}
        />
      )}
    </div>
  );
}

function ProductFormModal({ product, onClose, onSuccess }) {
  const isEditing = !!product;
  const [selectedPanelInfo, setSelectedPanelInfo] = useState({ type: 'xtream', index: product?.panel_index || 0 });
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [packageType, setPackageType] = useState(product?.is_trial ? 'trial' : 'regular'); // 'regular' or 'trial'
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    account_type: product?.account_type || 'subscriber',
    bouquets: product?.bouquets || [],
    max_connections: product?.max_connections || 2,
    reseller_credits: product?.reseller_credits || 500,
    reseller_max_lines: product?.reseller_max_lines || 50,
    trial_days: product?.trial_days || 0,
    active: product?.active ?? true,
    price_1: product?.prices?.['1'] || '',
    price_3: product?.prices?.['3'] || '',
    price_6: product?.prices?.['6'] || '',
    price_12: product?.prices?.['12'] || '',
    panel_index: product?.panel_index || 0,
    panel_type: product?.panel_type || 'xtream',
    is_trial: product?.is_trial || false,
    setup_instructions: product?.setup_instructions || '',
  });

  // Fetch settings to get panels list
  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const response = await adminAPI.getSettings();
      return response.data;
    },
  });

  const xtreamPanels = settings?.xtream?.panels || [];
  const xuionePanels = settings?.xuione?.panels || [];
  
  // Combine both panel types with a type indicator
  const allPanels = [
    ...xtreamPanels.map((panel, index) => ({ ...panel, type: 'xtream', originalIndex: index, label: `${panel.name} (XtreamUI)` })),
    ...xuionePanels.map((panel, index) => ({ ...panel, type: 'xuione', originalIndex: index, label: `${panel.name} (XuiOne)` }))
  ];
  
  const panels = allPanels;

  // Fetch available bouquets for selected panel
  const { data: availableBouquets } = useQuery({
    queryKey: ['bouquets', selectedPanelInfo.type, selectedPanelInfo.index],
    queryFn: async () => {
      const response = await adminAPI.getBouquets(selectedPanelInfo.index, selectedPanelInfo.type);
      return response.data;
    },
    enabled: panels.length > 0,
  });

  // Fetch regular packages from selected panel (XtreamUI or XuiOne)
  const { data: packagesData, isLoading: packagesLoading } = useQuery({
    queryKey: [`${selectedPanelInfo.type}-packages`, selectedPanelInfo.index],
    queryFn: async () => {
      if (selectedPanelInfo.type === 'xuione') {
        const response = await adminAPI.syncXuiOnePackages(selectedPanelInfo.index);
        return response.data.packages || [];
      } else {
        const response = await adminAPI.syncPackagesFromPanel(selectedPanelInfo.index);
        return response.data.packages || [];
      }
    },
    enabled: !isEditing && panels.length > 0 && packageType === 'regular',
  });

  // Fetch trial packages from selected panel (XtreamUI or XuiOne)
  const { data: trialPackagesData, isLoading: trialPackagesLoading } = useQuery({
    queryKey: [`${selectedPanelInfo.type}-trial-packages`, selectedPanelInfo.index],
    queryFn: async () => {
      if (selectedPanelInfo.type === 'xuione') {
        // XuiOne returns trial packages in a separate field
        const response = await adminAPI.syncXuiOnePackages(selectedPanelInfo.index);
        return response.data.trial_packages || [];
      } else {
        const response = await adminAPI.syncTrialPackagesFromPanel(selectedPanelInfo.index);
        return response.data.packages || [];
      }
    },
    enabled: !isEditing && panels.length > 0 && packageType === 'trial',
  });

  // Get current packages based on type
  const currentPackages = packageType === 'trial' ? trialPackagesData : packagesData;
  const currentLoading = packageType === 'trial' ? trialPackagesLoading : packagesLoading;

  // Handle package selection
  const handlePackageSelect = (packageId) => {
    const pkg = currentPackages?.find(p => p.id === parseInt(packageId));
    
    if (pkg) {
      setSelectedPackage(pkg);
      
      // Convert duration to months
      const durationMonths = convertDurationToMonths(pkg.duration, pkg.duration_unit);
      
      // Extract all bouquet IDs from package (ensure integers)
      const packageBouquetIds = pkg.bouquets.map(b => {
        const id = parseInt(b.id);
        return id;
      }).filter(id => !isNaN(id));
      
      console.log('Package bouquet IDs:', packageBouquetIds);
      
      // Auto-fill form from package
      setFormData(prev => ({
        ...prev,
        name: pkg.name,
        description: `${pkg.name} - ${pkg.max_connections} connection(s), ${pkg.duration} ${pkg.duration_unit}`,
        max_connections: parseInt(pkg.max_connections),
        bouquets: packageBouquetIds, // Set all bouquets from package
        is_trial: pkg.is_trial || packageType === 'trial', // Set trial flag
        trial_duration: pkg.duration, // Store actual trial duration
        trial_duration_unit: pkg.duration_unit, // Store actual unit (days, hours, etc.)
        // For trial packages, default price to 0 (FREE)
        [`price_${durationMonths}`]: pkg.is_trial || packageType === 'trial' ? '0' : '',
      }));
    }
  };

  const convertDurationToMonths = (duration, unit) => {
    switch (unit) {
      case 'days': return Math.max(1, Math.ceil(duration / 30));
      case 'months': return duration;
      case 'years': return duration * 12;
      default: return duration;
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const prices = {};
      if (data.price_1) prices['1'] = parseFloat(data.price_1);
      if (data.price_3) prices['3'] = parseFloat(data.price_3);
      if (data.price_6) prices['6'] = parseFloat(data.price_6);
      if (data.price_12) prices['12'] = parseFloat(data.price_12);

      const productData = {
        name: data.name,
        description: data.description,
        account_type: data.account_type,
        bouquets: data.bouquets,
        max_connections: parseInt(data.max_connections),
        reseller_credits: parseFloat(data.reseller_credits),
        reseller_max_lines: parseInt(data.reseller_max_lines),
        trial_days: parseInt(data.trial_days),
        prices: prices,
        active: data.active,
        xtream_package_id: selectedPackage ? selectedPackage.id : (product?.xtream_package_id || null),
        panel_index: isEditing ? (product?.panel_index ?? selectedPanelInfo.index) : selectedPanelInfo.index,
        panel_type: isEditing ? (product?.panel_type ?? selectedPanelInfo.type) : selectedPanelInfo.type,
        is_trial: data.is_trial || false,
        trial_duration: data.trial_duration || 0,
        trial_duration_unit: data.trial_duration_unit || 'days',
        setup_instructions: data.setup_instructions || '',
      };

      if (isEditing) {
        return adminAPI.updateProduct(product.id, productData);
      } else {
        return adminAPI.createProduct(productData);
      }
    },
    onSuccess: () => {
      alert(isEditing ? 'Product updated successfully!' : 'Product created successfully!');
      onSuccess();
    },
    onError: (error) => {
      alert('Failed to save product: ' + (error.response?.data?.detail || error.message));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleBouquetToggle = (bouquetId) => {
    setFormData(prev => {
      const newBouquets = prev.bouquets.includes(bouquetId)
        ? prev.bouquets.filter(id => id !== bouquetId)
        : [...prev.bouquets, bouquetId];
      return { ...prev, bouquets: newBouquets };
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 dark:bg-gray-900">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Panel Selection - Show for new products or when editing if multiple panels */}
            {panels.length > 1 && (
              <div className="md:col-span-2">
                <div className={`border rounded-lg p-4 mb-4 ${isEditing ? 'bg-gray-50 border-gray-300' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600'}`}>
                  <label className={`block text-sm font-semibold mb-3 ${isEditing ? 'text-gray-700' : 'text-blue-900 dark:text-blue-200'}`}>
                    {isEditing ? 'Product Panel' : 'Select Panel (XtreamUI or XuiOne) *'}
                  </label>
                  <select
                    value={`${selectedPanelInfo.type}-${selectedPanelInfo.index}`}
                    onChange={(e) => {
                      const [type, index] = e.target.value.split('-');
                      const panelIndex = parseInt(index);
                      setSelectedPanelInfo({ type, index: panelIndex });
                      setFormData(prev => ({ 
                        ...prev, 
                        panel_index: panelIndex,
                        panel_type: type
                      }));
                      setSelectedPackage(null); // Reset package when panel changes
                    }}
                    disabled={isEditing}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base font-medium ${
                      isEditing ? 'border-gray-300 opacity-75 cursor-not-allowed' : 'border-blue-400'
                    }`}
                  >
                    {panels.map((panel, idx) => (
                      <option key={idx} value={`${panel.type}-${panel.originalIndex}`}>
                        {panel.label} - {panel.panel_url}
                      </option>
                    ))}
                  </select>
                  <p className={`text-xs mt-2 ${isEditing ? 'text-gray-600' : 'text-blue-700 dark:text-blue-300'}`}>
                    {isEditing ? 'Panel cannot be changed after product creation' : 'Choose which panel to load packages from'}
                  </p>
                </div>
              </div>
            )}

            {/* Package Selection - REQUIRED for new products */}
            {!isEditing && (
              <div className="md:col-span-2">
                <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-2 border-green-400 dark:border-green-600 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-600" />
                    Select Package * {panels.length > 1 && `(from ${panels.find(p => p.type === selectedPanelInfo.type && p.originalIndex === selectedPanelInfo.index)?.label || 'selected panel'})`}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    <strong>Required:</strong> Choose a package to set pricing, duration, connections, and bouquets.
                  </p>
                  
                  {/* Package Type Toggle */}
                  <div className="mb-6 flex gap-2 bg-white dark:bg-gray-800 p-1 rounded-lg border-2 border-green-400 dark:border-green-600 dark:border-green-600 w-fit">
                    <button
                      type="button"
                      onClick={() => {
                        setPackageType('regular');
                        setSelectedPackage(null);
                      }}
                      className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                        packageType === 'regular' 
                          ? 'bg-green-600 text-white' 
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      Regular Packages
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPackageType('trial');
                        setSelectedPackage(null);
                      }}
                      className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                        packageType === 'trial' 
                          ? 'bg-purple-600 text-white' 
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      Trial Packages
                    </button>
                  </div>
                  
                  {currentLoading ? (
                    <div className="text-center py-6">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto"></div>
                      <p className="text-sm text-gray-600 mt-3">
                        Loading {packageType} packages from XtreamUI panel...
                      </p>
                    </div>
                  ) : currentPackages && currentPackages.length > 0 ? (
                    <select
                      required
                      value={selectedPackage?.id || ''}
                      onChange={(e) => handlePackageSelect(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-green-400 dark:border-green-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base font-medium"
                    >
                      <option value="">-- Select a {packageType} package from XtreamUI --</option>
                      {currentPackages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} | ${pkg.credits} | {pkg.duration} {pkg.duration_unit} | {pkg.max_connections} connection(s)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                      <p className="text-sm text-red-800 font-semibold mb-2">⚠ No {packageType} packages found!</p>
                      <p className="text-sm text-red-700">
                        No {packageType} packages available from this panel. {packageType === 'trial' ? 'Try selecting "Regular Packages" instead.' : 'Please sync packages from the panel.'}
                      </p>
                    </div>
                  )}
                  
                  {selectedPackage && (
                    <div className="mt-4 p-4 bg-white rounded-lg border-2 border-green-400 dark:border-green-600 shadow-sm">
                      <p className="text-sm font-semibold text-green-900 mb-3">
                        ✓ Selected Package: {selectedPackage.name}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="bg-green-50 p-3 rounded">
                          <span className="text-gray-600 block mb-1">Price:</span>
                          <span className="font-bold text-green-700 text-lg">${selectedPackage.credits}</span>
                        </div>
                        <div className="bg-blue-50 p-3 rounded">
                          <span className="text-gray-600 block mb-1">Duration:</span>
                          <span className="font-bold text-blue-700 dark:text-blue-300 text-lg">{selectedPackage.duration} {selectedPackage.duration_unit}</span>
                        </div>
                        <div className="bg-purple-50 p-3 rounded">
                          <span className="text-gray-600 block mb-1">Connections:</span>
                          <span className="font-bold text-purple-700 text-lg">{selectedPackage.max_connections}</span>
                        </div>
                        <div className="bg-orange-50 p-3 rounded">
                          <span className="text-gray-600 block mb-1">Bouquets:</span>
                          <span className="font-bold text-orange-700 text-lg">{selectedPackage.bouquets?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {!selectedPackage && packagesData && packagesData.length > 0 && (
                    <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-600 rounded-lg p-3">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        ⚠ Please select a package to continue
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Show fields only if package selected OR editing existing */}
            {(selectedPackage || isEditing) ? (
            <>
            {/* Basic Information */}
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="IPTV Subscriber - 1 Month"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Monthly IPTV subscription with full channel access"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Setup Instructions (Optional)
              </label>
              <textarea
                rows={4}
                value={formData.setup_instructions}
                onChange={(e) => setFormData({ ...formData, setup_instructions: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="1. Download Panel 1 App from Downloads section&#10;2. Enter credentials shown above&#10;3. Enjoy streaming!"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Custom instructions shown to customers. Leave blank for default instructions.
              </p>
            </div>

            {/* Account type fixed to subscriber for regular products */}
            <input type="hidden" name="account_type" value="subscriber" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Active
              </label>
              <select
                value={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.value === 'true' })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            {/* Subscriber Settings (always shown for regular products) */}
            <>
              <div className="md:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-4">Subscriber Settings</h3>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bouquets (Channel Packages) *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border border-gray-300 rounded-lg bg-gray-50">
                    {availableBouquets?.map((bouquet) => (
                      <label
                        key={bouquet.id}
                        className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          checked={formData.bouquets.includes(parseInt(bouquet.id)) || formData.bouquets.includes(bouquet.id)}
                          onChange={() => handleBouquetToggle(bouquet.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">{bouquet.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">ID: {bouquet.id}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Selected: {formData.bouquets.join(', ') || 'None'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Connections
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.max_connections}
                    onChange={(e) => setFormData({ ...formData, max_connections: e.target.value })}
                    disabled={selectedPackage !== null}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {selectedPackage && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      ✓ Set by package: {formData.max_connections} connection(s)
                    </p>
                  )}
                </div>
              </>

            {/* Pricing */}
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-4">Pricing</h3>
              {selectedPackage && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Package duration: <strong>{selectedPackage.duration} {selectedPackage.duration_unit}</strong>
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price {selectedPackage ? `(${selectedPackage.duration} ${selectedPackage.duration_unit})` : ''}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={selectedPackage ? 
                    (formData[`price_${convertDurationToMonths(selectedPackage.duration, selectedPackage.duration_unit)}`] || selectedPackage.credits) :
                    (formData.price_1 || formData.price_3 || formData.price_6 || formData.price_12 || '')
                  }
                  onChange={(e) => {
                    if (selectedPackage) {
                      const months = convertDurationToMonths(selectedPackage.duration, selectedPackage.duration_unit);
                      setFormData({ ...formData, [`price_${months}`]: e.target.value });
                    } else {
                      setFormData({ ...formData, price_1: e.target.value });
                    }
                  }}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={selectedPackage ? selectedPackage.credits : "15.00"}
                />
              </div>
              {selectedPackage && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Package cost from XtreamUI: ${selectedPackage.credits} | Set your selling price above
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trial Days
              </label>
              <input
                type="number"
                min="0"
                value={formData.trial_days}
                onChange={(e) => setFormData({ ...formData, trial_days: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Free trial period in days (0 = no trial)</p>
            </div>

          {/* Form Actions */}
          <div className="md:col-span-2 flex gap-4 mt-8 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending || (!isEditing && !selectedPackage)}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saveMutation.isPending ? 'Saving...' : (isEditing ? 'Update Product' : selectedPackage ? 'Create Product' : 'Select Package First')}
            </button>
          </div>
          </>
          ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}


// Reseller Package Modal Component
function ResellerPackageModal({ onClose, onSuccess, panels, xtreamPanels, xuionePanels, editingProduct }) {
  const [formData, setFormData] = useState({
    name: editingProduct?.name || '',
    description: editingProduct?.description || '',
    reseller_credits: editingProduct?.reseller_credits || 500,
    price: editingProduct?.prices ? Object.values(editingProduct.prices)[0] || '' : '',
    panel_index: editingProduct?.panel_index || 0,
    panel_type: editingProduct?.panel_type || 'xtream',
    custom_panel_url: editingProduct?.custom_panel_url || ''
  });
  
  const isEditing = !!editingProduct;

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const prices = {
        '1': parseFloat(data.price)  // Store as 1-month for compatibility, but it's lifetime
      };
      
      const productData = {
        name: data.name,
        description: data.description,
        account_type: 'reseller',
        bouquets: [],
        max_connections: 0,
        reseller_credits: parseFloat(data.reseller_credits),
        reseller_max_lines: 0,
        trial_days: 0,
        prices: prices,
        active: true,
        panel_index: data.panel_index,
        panel_type: data.panel_type,
        custom_panel_url: data.custom_panel_url || '',
        setup_instructions: '',
        is_trial: false
      };
      
      // Update if editing, create if new
      if (isEditing) {
        return adminAPI.updateProduct(editingProduct.id, productData);
      } else {
        return adminAPI.createProduct(productData);
      }
    },
    onSuccess: () => {
      alert(isEditing ? 'Reseller package updated successfully!' : 'Reseller package created successfully!');
      onSuccess();
    },
    onError: (error) => {
      alert('Error: ' + (error.response?.data?.detail || error.message));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{isEditing ? 'Edit Reseller Package' : 'Add Reseller Package'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Package Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Reseller Panel - 500 Credits"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description *
              </label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Reseller panel with 500 credits"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reseller Credits *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.reseller_credits}
                onChange={(e) => setFormData({...formData, reseller_credits: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Credits allocated to reseller</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Panel (XtreamUI or XuiOne) *
              </label>
              <select
                value={`${formData.panel_type}-${formData.panel_index}`}
                onChange={(e) => {
                  const [type, index] = e.target.value.split('-');
                  setFormData({...formData, panel_type: type, panel_index: parseInt(index)});
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {panels.map((panel, idx) => (
                  <option key={idx} value={`${panel.type}-${panel.originalIndex}`}>
                    {panel.label || panel.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Selected panel: {panels[formData.panel_index]?.panel_url || 'Not set'}
              </p>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Panel URL for Customers *
              </label>
              <input
                type="url"
                required
                value={formData.custom_panel_url || ''}
                onChange={(e) => setFormData({...formData, custom_panel_url: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="https://panel.example.com"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                The panel URL that customers will use to access their reseller panel.
              </p>
            </div>

            {/* Pricing - One-time payment */}
            <div className="col-span-2 border-t pt-4 mt-2">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Pricing (One-Time Payment) *</h4>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Price ($) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  placeholder="500.00"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  ℹ️ Lifetime access - One-time payment, no recurring charges
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="col-span-2 flex gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {saveMutation.isPending ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Package' : 'Create Package')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

