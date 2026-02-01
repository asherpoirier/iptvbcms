import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productsAPI, panelsAPI } from '../api/api';
import { useAuthStore, useCartStore } from '../store/store';
import { useBrandingStore } from '../store/branding';
import { ShoppingCart, LogIn, UserPlus, Server, Users, Info, X, Filter, Grid } from 'lucide-react';
import { getPanelGradient, getPanelColor } from '../utils/panelColors';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function HomePage() {
  const { user } = useAuthStore();
  const { items } = useCartStore();
  const { branding, fetchBranding } = useBrandingStore();
  
  const [selectedPanel, setSelectedPanel] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');
  
  // Fetch branding when component mounts
  React.useEffect(() => {
    fetchBranding();
  }, []);
  
  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await productsAPI.getAll();
      return response.data;
    },
  });

  // Fetch panel names (public endpoint)
  const { data: panelData } = useQuery({
    queryKey: ['panel-names'],
    queryFn: async () => {
      const response = await panelsAPI.getNames();
      return response.data;
    },
  });

  // Group products by panel type and index
  const productsByPanel = useMemo(() => {
    if (!products) return {};
    
    const grouped = {};
    products.forEach(product => {
      const panelType = product.panel_type || 'xtream';
      const panelIndex = product.panel_index ?? 0;
      const panelKey = `${panelType}-${panelIndex}`;
      
      if (!grouped[panelKey]) {
        grouped[panelKey] = {
          products: [],
          panelType: panelType,
          panelIndex: panelIndex
        };
      }
      grouped[panelKey].products.push(product);
    });
    
    return grouped;
  }, [products]);

  // Get panel name with type
  const getPanelName = (panelIndex, panelType = 'xtream') => {
    const panels = panelData?.panels || [];
    const xuionePanels = panelData?.xuione_panels || [];
    
    let panel;
    if (panelType === 'xuione') {
      panel = xuionePanels.find(p => p.index === Number(panelIndex));
      return panel?.name || `Panel ${Number(panelIndex) + 1}`;
    } else {
      panel = panels.find(p => p.index === Number(panelIndex));
      return panel?.name || `Server ${Number(panelIndex) + 1}`;
    }
  };

  // Get all unique panel options for filter
  const panelOptions = useMemo(() => {
    const options = [{ key: 'all', name: 'All Panels' }];
    
    Object.entries(productsByPanel).forEach(([panelKey, panelGroup]) => {
      const { panelType, panelIndex } = panelGroup;
      const panelName = getPanelName(panelIndex, panelType);
      options.push({
        key: panelKey,
        name: panelName
      });
    });
    
    return options;
  }, [productsByPanel, panelData]);

  // Filter products based on selections
  const filteredProducts = useMemo(() => {
    let filtered = { ...productsByPanel };
    
    // Filter by panel
    if (selectedPanel !== 'all') {
      filtered = {
        [selectedPanel]: productsByPanel[selectedPanel]
      };
      
      // If panel filter is active, ignore price filter to avoid empty results
      return filtered;
    }
    
    // Apply account type filter first (if not "all")
    if (accountTypeFilter !== 'all') {
      Object.keys(filtered).forEach(panelKey => {
        filtered[panelKey] = {
          ...filtered[panelKey],
          products: filtered[panelKey].products.filter(product => {
            if (accountTypeFilter === 'subscriber') {
              return product.account_type === 'subscriber' || !product.account_type;
            } else if (accountTypeFilter === 'reseller') {
              return product.account_type === 'reseller';
            }
            return true;
          })
        };
      });
    }
    
    // Only apply price filter if "All Panels" is selected
    if (priceFilter !== 'all') {
      Object.keys(filtered).forEach(panelKey => {
        filtered[panelKey] = {
          ...filtered[panelKey],
          products: filtered[panelKey].products.filter(product => {
            const prices = Object.values(product.prices);
            const minPrice = Math.min(...prices);
            
            if (priceFilter === 'free') return minPrice === 0;
            if (priceFilter === 'under10') return minPrice > 0 && minPrice < 10;
            if (priceFilter === 'under25') return minPrice >= 10 && minPrice < 25;
            if (priceFilter === 'over25') return minPrice >= 25;
            return true;
          })
        };
      });
    }
    
    return filtered;
  }, [productsByPanel, selectedPanel, priceFilter, accountTypeFilter]);

  return (
    <div 
      className="min-h-screen dark:bg-gray-800"
      style={{ 
        backgroundColor: branding.background_color || '#f9fafb'
      }}
    >
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-900 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <Server className="w-8 h-8" style={{ color: branding.primary_color || '#3b82f6' }} />
              <span className="text-xl font-bold dark:text-white">{branding.site_name || 'IPTV Billing'}</span>
            </Link>
            
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <Link 
                    to="/cart" 
                    className="relative flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-white"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    {items.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {items.length}
                      </span>
                    )}
                  </Link>
                  <Link 
                    to="/dashboard" 
                    className="px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-white"
                  >
                    Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link 
                    to="/login" 
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-white"
                  >
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </Link>
                  <Link 
                    to="/register" 
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white"
                    style={{ backgroundColor: branding.primary_color || '#3b82f6' }}
                  >
                    <UserPlus className="w-5 h-5" />
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className="py-20 text-white relative overflow-hidden"
        style={{ 
          background: branding.hero_background_image 
            ? `url(${branding.hero_background_image}) center/cover no-repeat`
            : `linear-gradient(135deg, ${branding.primary_color || '#3b82f6'} 0%, ${branding.secondary_color || '#1d4ed8'} 100%)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Dark overlay for better text readability on images */}
        {branding.hero_background_image && (
          <div className="absolute inset-0 bg-black bg-opacity-40 z-0"></div>
        )}
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-5xl font-bold mb-6 drop-shadow-lg">{branding.hero_title || 'Premium IPTV Services'}</h1>
          <p className="text-xl mb-8 opacity-90 drop-shadow-md">{branding.hero_description || 'Stream thousands of channels in HD quality'}</p>
          <a 
            href="#pricing" 
            className="inline-block px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition shadow-lg"
          >
            View Plans
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${branding.primary_color}20` }}>
              <Server className="w-6 h-6" style={{ color: branding.primary_color }} />
            </div>
            <h3 className="text-xl font-semibold mb-2 dark:text-white">{branding.feature_1_title || 'Instant Activation'}</h3>
            <p className="text-gray-600 dark:text-gray-300">
              {branding.feature_1_description || 'Get your credentials immediately after payment. Start watching within minutes.'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${branding.primary_color}20` }}>
              <Users className="w-6 h-6" style={{ color: branding.primary_color }} />
            </div>
            <h3 className="text-xl font-semibold mb-2 dark:text-white">{branding.feature_2_title || 'Multiple Connections'}</h3>
            <p className="text-gray-600 dark:text-gray-300">
              {branding.feature_2_description || 'Watch on multiple devices simultaneously. Perfect for families.'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${branding.primary_color}20` }}>
              <ShoppingCart className="w-6 h-6" style={{ color: branding.primary_color }} />
            </div>
            <h3 className="text-xl font-semibold mb-2 dark:text-white">{branding.feature_3_title || 'Flexible Plans'}</h3>
            <p className="text-gray-600 dark:text-gray-300">
              {branding.feature_3_description || 'Choose from 1, 3, 6, or 12-month plans. Save more with longer subscriptions.'}
            </p>
          </div>
        </div>
      </section>

      {/* Products Section with Sidebar */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-center mb-12 dark:text-white">Choose Your Plan</h2>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar Filters */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 sticky top-24">
                <div className="flex items-center gap-2 mb-6">
                  <Filter className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
                </div>

                {/* Panel Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Select Service
                  </label>
                  <div className="space-y-2">
                    {panelOptions.map(option => (
                      <button
                        key={option.key}
                        onClick={() => {
                          setSelectedPanel(option.key);
                          // Reset price filter when selecting a specific panel
                          if (option.key !== 'all') {
                            setPriceFilter('all');
                          }
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedPanel === option.key
                            ? 'text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                        style={selectedPanel === option.key ? {
                          backgroundColor: branding.product_card_color || '#2563eb'
                        } : {}}
                        data-testid={`filter-panel-${option.key}`}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Account Type Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Product Type
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setAccountTypeFilter('all')}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        accountTypeFilter === 'all'
                          ? 'text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      style={accountTypeFilter === 'all' ? {
                        backgroundColor: branding.product_card_color || '#2563eb'
                      } : {}}
                    >
                      All Products
                    </button>
                    <button
                      onClick={() => setAccountTypeFilter('subscriber')}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        accountTypeFilter === 'subscriber'
                          ? 'text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      style={accountTypeFilter === 'subscriber' ? {
                        backgroundColor: branding.product_card_color || '#2563eb'
                      } : {}}
                    >
                      Subscription Plans
                    </button>
                    <button
                      onClick={() => setAccountTypeFilter('reseller')}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        accountTypeFilter === 'reseller'
                          ? 'text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      style={accountTypeFilter === 'reseller' ? {
                        backgroundColor: branding.product_card_color || '#2563eb'
                      } : {}}
                    >
                      Reseller Packages
                    </button>
                  </div>
                </div>

                {/* Price Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Price Range
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setPriceFilter('all')}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        priceFilter === 'all'
                          ? 'text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      style={priceFilter === 'all' ? {
                        backgroundColor: branding.product_card_color || '#2563eb'
                      } : {}}
                    >
                      All Prices
                    </button>
                    <button
                      onClick={() => setPriceFilter('free')}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        priceFilter === 'free'
                          ? 'text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      style={priceFilter === 'free' ? {
                        backgroundColor: branding.product_card_color || '#2563eb'
                      } : {}}
                    >
                      Free Trials
                    </button>
                    <button
                      onClick={() => setPriceFilter('under10')}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        priceFilter === 'under10'
                          ? 'text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      style={priceFilter === 'under10' ? {
                        backgroundColor: branding.product_card_color || '#2563eb'
                      } : {}}
                    >
                      Under $10
                    </button>
                    <button
                      onClick={() => setPriceFilter('under25')}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        priceFilter === 'under25'
                          ? 'text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      style={priceFilter === 'under25' ? {
                        backgroundColor: branding.product_card_color || '#2563eb'
                      } : {}}
                    >
                      $10 - $25
                    </button>
                    <button
                      onClick={() => setPriceFilter('over25')}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        priceFilter === 'over25'
                          ? 'text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      style={priceFilter === 'over25' ? {
                        backgroundColor: branding.product_card_color || '#2563eb'
                      } : {}}
                    >
                      $25+
                    </button>
                  </div>
                </div>

                {/* Active Filters Summary */}
                {(selectedPanel !== 'all' || priceFilter !== 'all' || accountTypeFilter !== 'all') && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => {
                        setSelectedPanel('all');
                        setPriceFilter('all');
                        setAccountTypeFilter('all');
                      }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <div className="space-y-16">
                {Object.entries(filteredProducts)
                  .sort(([keyA], [keyB]) => {
                    // Sort by panel type first (xtream before xuione), then by index
                    const [typeA, indexA] = keyA.split('-');
                    const [typeB, indexB] = keyB.split('-');
                    if (typeA !== typeB) {
                      return typeA === 'xtream' ? -1 : 1;
                    }
                    return Number(indexA) - Number(indexB);
                  })
                  .map(([panelKey, panelGroup]) => {
                    const { products: panelProducts, panelType, panelIndex } = panelGroup;
                    
                    if (!panelProducts || panelProducts.length === 0) return null;
                    
                    const panelColor = getPanelColor(Number(panelIndex));
                    const panelName = getPanelName(Number(panelIndex), panelType);
                    
                    return (
                      <div key={panelKey} className="space-y-6">
                        {/* Panel Category Header */}
                        <div className="flex items-center gap-4">
                          <div className={`h-1 flex-1 bg-gradient-to-r ${panelColor.gradient}`}></div>
                          <div className="text-center">
                            <h3 className={`text-2xl font-bold ${panelColor.text} dark:text-white`}>
                              {panelName}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {panelProducts.length} {panelProducts.length === 1 ? 'plan' : 'plans'} available
                            </p>
                          </div>
                          <div className={`h-1 flex-1 bg-gradient-to-r ${panelColor.gradient}`}></div>
                        </div>

                        {/* Group by account type */}
                        {(() => {
                          const subscribers = panelProducts.filter(p => p.account_type !== 'reseller');
                          const resellers = panelProducts.filter(p => p.account_type === 'reseller');
                        
                          return (
                            <>
                              {/* Subscriber Packages */}
                              {subscribers.length > 0 && (
                                <div className="space-y-4">
                                  <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Server className="w-5 h-5" />
                                    Subscription Plans
                                  </h4>
                                  <div className="space-y-4">
                                    {subscribers
                                      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                                      .map((product) => (
                                        <ProductCard key={product.id} product={product} />
                                      ))}
                                  </div>
                                </div>
                              )}

                              {/* Reseller Packages */}
                              {resellers.length > 0 && (
                                <div className="space-y-4 mt-8">
                                  <h4 className="text-lg font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                    <Users className="w-5 h-5" />
                                    Reseller Packages
                                  </h4>
                                  <div className="space-y-4">
                                    {resellers
                                      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                                      .map((product) => (
                                        <ProductCard key={product.id} product={product} />
                                      ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    );
                  })}

                {/* Empty State */}
                {Object.keys(filteredProducts).length === 0 && (
                  <div className="text-center py-16">
                    <Grid className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No products found</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Try adjusting your filters
                    </p>
                    <button
                      onClick={() => {
                        setSelectedPanel('all');
                        setPriceFilter('all');
                      }}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">{branding.site_name}</h3>
            <p className="text-gray-400">Premium IPTV Services</p>
            <p className="text-gray-500 mt-4 text-sm">
              © 2025 {branding.site_name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProductCard({ product }) {
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const { branding } = useBrandingStore();
  const [showChannels, setShowChannels] = React.useState(false);
  const [channels, setChannels] = React.useState([]);
  const [loadingChannels, setLoadingChannels] = React.useState(false);

  const handleAddToCart = (termMonths, price) => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    addItem({
      product_id: product.id,
      product_name: product.name,
      term_months: termMonths,
      price: price,
      account_type: product.account_type,
    });

    window.location.href = '/checkout';
  };
  
  const handleShowChannels = async () => {
    setShowChannels(true);
    setLoadingChannels(true);
    
    try {
      const response = await axios.get(`${API_URL}/api/products/${product.id}/channels`);
      setChannels(response.data.channels || []);
    } catch (error) {
      console.error('Failed to load channels:', error);
      setChannels([]);
    } finally {
      setLoadingChannels(false);
    }
  };

  // Get custom product card color or fallback to panel color
  const cardColor = branding.product_card_color || '#2563eb';
  
  // Create gradient from card color (lighter to darker)
  const lightenColor = (hex, percent) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1);
  };
  
  const darkenColor = (hex, percent) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (0x1000000 + (R > 0 ? R : 0) * 0x10000 +
      (G > 0 ? G : 0) * 0x100 +
      (B > 0 ? B : 0))
      .toString(16).slice(1);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col md:flex-row">
        {/* Left: Product Info */}
        <div 
          className="md:w-1/3 p-4 text-white relative"
          style={{
            background: `linear-gradient(135deg, ${cardColor} 0%, ${darkenColor(cardColor, 15)} 100%)`
          }}
        >
          {product.is_trial && (
            <div className="absolute top-2 right-2">
              <span className="px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full shadow-lg">
                TRIAL
              </span>
            </div>
          )}
          <h3 className="text-lg font-bold mb-1 pr-12">{product.name}</h3>
          <p className="text-white text-xs opacity-90 line-clamp-2">{product.description}</p>
          
          {/* Product Details */}
          <div className="mt-3 pt-3 border-t border-white border-opacity-20">
            {product.account_type === 'subscriber' && (
              <div className="flex items-center gap-2 text-xs">
                <Server className="w-3.5 h-3.5" />
                <span>{product.max_connections} connections</span>
              </div>
            )}
            {product.account_type === 'reseller' && (
              <div className="flex items-center gap-2 text-xs">
                <Users className="w-3.5 h-3.5" />
                <span>{product.reseller_credits} credits</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Pricing & Actions */}
        <div className="md:w-2/3 p-4 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Available Plans:</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(product.prices).map(([term, price]) => {
                let displayTerm;
                if (product.account_type === 'reseller') {
                  displayTerm = 'Purchase';
                } else if (product.is_trial && product.trial_duration) {
                  const unit = product.trial_duration_unit || 'days';
                  const singularUnit = unit.toLowerCase().endsWith('s') ? unit.slice(0, -1) : unit;
                  displayTerm = `${product.trial_duration} ${product.trial_duration === 1 ? singularUnit : unit}`;
                } else {
                  displayTerm = `${term} ${parseInt(term) === 1 ? 'Mo' : 'Mos'}`;
                }
                
                return (
                  <button
                    key={term}
                    onClick={() => handleAddToCart(parseInt(term), price)}
                    className="flex-1 min-w-[110px] flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 p-3 rounded-lg transition border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 group"
                  >
                    <span className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">{displayTerm}</span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                      {product.is_trial && parseFloat(price) === 0 ? 'FREE' : `$${price}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Channel List Button */}
          {product.account_type === 'subscriber' && (
            <button
              onClick={handleShowChannels}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition text-sm font-medium"
            >
              <Info className="w-4 h-4" />
              View Channels
            </button>
          )}
        </div>
      </div>
      
      {/* Channel List Modal */}
      {showChannels && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowChannels(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Live TV Channel Packages</p>
              </div>
              <button
                onClick={() => setShowChannels(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingChannels ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600 dark:text-gray-400">Loading channel packages...</p>
                </div>
              ) : channels.length > 0 ? (
                <div className="space-y-2">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700 mb-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Included with this service:</strong> Access to {channels.length} live TV channel packages
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      (Movies and series on-demand content not listed here)
                    </p>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-2">
                    {channels.map((channel, idx) => (
                      <div
                        key={channel.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{idx + 1}</span>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white text-sm">{channel.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">Channel information not available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
