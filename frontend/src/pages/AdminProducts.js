import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft, Plus, Edit, Trash2, X, Save, Package, ChevronUp, ChevronDown } from 'lucide-react';
import { getPanelGradient, getPanelColor } from '../utils/panelColors';

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
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

  const panels = settings?.xtream?.panels || [];
  
  const getPanelName = (panelIndex) => {
    if (panelIndex === undefined || panelIndex === null) return 'Default Panel';
    return panels[panelIndex]?.name || `Panel ${panelIndex}`;
  };

  // Group products by panel
  const productsByPanel = React.useMemo(() => {
    if (!products) return {};
    
    const grouped = {};
    products.forEach(product => {
      const panelIndex = product.panel_index ?? 0;
      if (!grouped[panelIndex]) {
        grouped[panelIndex] = [];
      }
      grouped[panelIndex].push(product);
    });
    
    return grouped;
  }, [products]);

  const handleAddNew = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
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
            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add New Product
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Manage Products</h1>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(productsByPanel).sort(([a], [b]) => Number(a) - Number(b)).map(([panelIndex, panelProducts]) => {
              const panelColor = getPanelColor(Number(panelIndex));
              const panelName = getPanelName(Number(panelIndex));
              
              return (
                <div key={panelIndex} className="space-y-6">
                  {/* Panel Category Header */}
                  <div className="flex items-center gap-4">
                    <div className={`h-1 flex-1 bg-gradient-to-r ${panelColor.gradient}`}></div>
                    <div className="text-center">
                      <h2 className={`text-2xl font-bold text-white`}>
                        {panelName}
                      </h2>
                      <p className="text-sm text-gray-400 mt-1">
                        {panelProducts.length} {panelProducts.length === 1 ? 'product' : 'products'}
                      </p>
                    </div>
                    <div className={`h-1 flex-1 bg-gradient-to-r ${panelColor.gradient}`}></div>
                  </div>

                  {/* Products Grid */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {panelProducts.map((product, index) => (
                      <div key={product.id} className="bg-white dark:bg-gray-900 rounded-lg shadow hover:shadow-lg transition relative">
                        {/* Reorder Buttons */}
                        <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                          <button
                            onClick={() => handleReorder(product, 'up')}
                            disabled={index === 0}
                            className={`p-1 rounded bg-white shadow hover:bg-gray-100 ${
                              index === 0 ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title="Move Up"
                            data-testid={`reorder-up-${product.id}`}
                          >
                            <ChevronUp className="w-4 h-4 text-gray-700" />
                          </button>
                          <button
                            onClick={() => handleReorder(product, 'down')}
                            disabled={index === panelProducts.length - 1}
                            className={`p-1 rounded bg-white shadow hover:bg-gray-100 ${
                              index === panelProducts.length - 1 ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title="Move Down"
                            data-testid={`reorder-down-${product.id}`}
                          >
                            <ChevronDown className="w-4 h-4 text-gray-700" />
                          </button>
                        </div>

                        <div className={`bg-gradient-to-r ${getPanelGradient(product.panel_index || 0)} p-6 text-white`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 pr-8">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-xl font-bold">{product.name}</h3>
                                {product.is_trial && (
                                  <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded">
                                    TRIAL
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-white opacity-75 mt-1">
                                📡 {getPanelName(product.panel_index)}
                              </p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              product.active ? 'bg-green-400 text-green-900' : 'bg-gray-300 text-gray-700'
                            }`}>
                              {product.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-white opacity-90 text-sm">{product.description}</p>
                        </div>
                <div className="p-6 dark:bg-gray-900">
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Type: <span className="font-semibold text-gray-900 dark:text-white capitalize">{product.account_type}</span>
                    </p>
                    {product.account_type === 'subscriber' && (
                      <>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Max Connections: <span className="font-semibold text-gray-900 dark:text-white">{product.max_connections}</span>
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Bouquets: <span className="font-semibold text-gray-900 dark:text-white">{product.bouquets.join(', ')}</span>
                        </p>
                      </>
                    )}
                    {product.account_type === 'reseller' && (
                      <>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Credits: <span className="font-semibold text-gray-900 dark:text-white">${product.reseller_credits}</span>
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Max Lines: <span className="font-semibold text-gray-900 dark:text-white">{product.reseller_max_lines}</span>
                        </p>
                      </>
                    )}
                  </div>
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mb-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-semibold">Pricing:</p>
                    <div className="space-y-1">
                      {Object.entries(product.prices).map(([term, price]) => (
                        <div key={term} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{term} month{parseInt(term) > 1 ? 's' : ''}:</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">${price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-4 py-2 rounded-lg hover:bg-red-200 dark:hover:bg-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    })}
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
  const [selectedPanel, setSelectedPanel] = useState(product?.panel_index || 0);
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

  const panels = settings?.xtream?.panels || [];

  // Fetch available bouquets for selected panel
  const { data: availableBouquets } = useQuery({
    queryKey: ['bouquets', selectedPanel],
    queryFn: async () => {
      const response = await adminAPI.getBouquets(selectedPanel);
      return response.data;
    },
    enabled: panels.length > 0,
  });

  // Fetch regular packages from selected XtreamUI panel
  const { data: packagesData, isLoading: packagesLoading } = useQuery({
    queryKey: ['xtream-packages', selectedPanel],
    queryFn: async () => {
      const response = await adminAPI.syncPackagesFromPanel(selectedPanel);
      return response.data.packages || [];
    },
    enabled: !isEditing && panels.length > 0 && packageType === 'regular',
  });

  // Fetch trial packages from selected XtreamUI panel
  const { data: trialPackagesData, isLoading: trialPackagesLoading } = useQuery({
    queryKey: ['xtream-trial-packages', selectedPanel],
    queryFn: async () => {
      const response = await adminAPI.syncTrialPackagesFromPanel(selectedPanel);
      return response.data.packages || [];
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
        panel_index: isEditing ? (product?.panel_index ?? selectedPanel) : selectedPanel,
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
                    {isEditing ? 'Product Panel' : 'Select XtreamUI Panel *'}
                  </label>
                  <select
                    value={selectedPanel}
                    onChange={(e) => {
                      const newPanelIndex = parseInt(e.target.value);
                      setSelectedPanel(newPanelIndex);
                      setFormData(prev => ({ ...prev, panel_index: newPanelIndex }));
                      setSelectedPackage(null); // Reset package when panel changes
                    }}
                    disabled={isEditing}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base font-medium ${
                      isEditing ? 'border-gray-300 opacity-75 cursor-not-allowed' : 'border-blue-400'
                    }`}
                  >
                    {panels.map((panel, index) => (
                      <option key={index} value={index}>
                        {panel.name} - {panel.panel_url}
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
                    Select XtreamUI Package * {panels.length > 1 && `(from ${panels[selectedPanel]?.name || 'selected panel'})`}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type *
              </label>
              <select
                value={formData.account_type}
                onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="subscriber">Subscriber</option>
                <option value="reseller">Reseller</option>
              </select>
            </div>

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

            {/* Subscriber Settings */}
            {formData.account_type === 'subscriber' && (
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
            )}

            {/* Reseller Settings */}
            {formData.account_type === 'reseller' && (
              <>
                <div className="md:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-4">Reseller Settings</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reseller Credits
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.reseller_credits}
                    onChange={(e) => setFormData({ ...formData, reseller_credits: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="500.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Lines
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.reseller_max_lines}
                    onChange={(e) => setFormData({ ...formData, reseller_max_lines: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="50"
                  />
                </div>
              </>
            )}

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
