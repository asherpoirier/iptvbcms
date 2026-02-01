import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productsAPI, panelsAPI } from '../api/api';
import { useAuthStore, useCartStore } from '../store/store';
import { useBrandingStore } from '../store/branding';
import { ShoppingCart, LogIn, UserPlus, Server, Users } from 'lucide-react';
import { getPanelGradient, getPanelColor } from '../utils/panelColors';

export default function HomePage() {
  const { user } = useAuthStore();
  const { items } = useCartStore();
  const { branding, fetchBranding } = useBrandingStore();
  
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

  // Get panel name
  const getPanelName = (panelIndex) => {
    const panels = panelData?.panels || [];
    const panel = panels.find(p => p.index === Number(panelIndex));
    return panel?.name || `Server ${Number(panelIndex) + 1}`;
  };

  return (
    <div 
      className="min-h-screen dark:bg-gray-800"
      style={{
        background: branding.background_image_url 
          ? `url(${branding.background_image_url})` 
          : (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
              ? 'linear-gradient(to bottom, rgb(31, 41, 55), rgb(55, 65, 81))'
              : 'linear-gradient(to bottom, rgb(239, 246, 255), rgb(255, 255, 255))'),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={branding.site_name} className="h-8" />
              ) : (
                <Server className="w-8 h-8" style={{ color: branding.primary_color }} />
              )}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{branding.site_name}</h1>
            </div>
            <nav className="flex items-center gap-4">
              {user ? (
                <>
                  <Link
                    to={user.role === 'admin' ? '/admin' : '/dashboard'}
                    className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Dashboard
                  </Link>
                  {items.length > 0 && (
                    <Link
                      to="/checkout"
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      Cart ({items.length})
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="flex items-center gap-2 text-gray-700 hover:text-blue-600"
                  >
                    <LogIn className="w-5 h-5" />
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    <UserPlus className="w-5 h-5" />
                    Sign Up
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            {branding.hero_title || 'Premium IPTV Subscriptions'}
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            {branding.hero_description || 'Access thousands of channels with our reliable IPTV service. Flexible plans, instant activation, 24/7 support.'}
          </p>
          <a
            href="#pricing"
            className="inline-block text-white px-8 py-4 rounded-lg text-lg font-semibold hover:opacity-90 transition"
            style={{ backgroundColor: branding.primary_color }}
          >
            View Pricing
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

      {/* Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-center mb-12 dark:text-white">Choose Your Plan</h2>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-16">
            {Object.entries(productsByPanel).sort(([a], [b]) => Number(a) - Number(b)).map(([panelIndex, panelProducts]) => {
              const panelColor = getPanelColor(Number(panelIndex));
              const panelName = getPanelName(Number(panelIndex));
              
              return (
                <div key={panelIndex} className="space-y-6">
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

                  {/* Products Grid */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {panelProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </div>
              );
            })}
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

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition">
      <div className={`bg-gradient-to-r ${getPanelGradient(product.panel_index || 0)} p-6 text-white relative`}>
        {product.is_trial && (
          <div className="absolute top-3 right-3">
            <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full shadow-lg">
              TRIAL
            </span>
          </div>
        )}
        <h3 className="text-2xl font-bold mb-2">{product.name}</h3>
        <p className="text-white opacity-90">{product.description}</p>
      </div>
      <div className="p-6 dark:bg-gray-900">
        {product.account_type === 'subscriber' && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Max Connections:</p>
            <p className="text-lg font-semibold dark:text-white">{product.max_connections} devices</p>
          </div>
        )}
        {product.account_type === 'reseller' && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Reseller Credits:</p>
            <p className="text-lg font-semibold dark:text-white">${product.reseller_credits}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Max Lines: {product.reseller_max_lines}</p>
          </div>
        )}
        <div className="space-y-3 mt-6">
          {Object.entries(product.prices).map(([term, price]) => {
            // For trial products, show actual trial duration instead of price term
            let displayTerm;
            if (product.is_trial && product.trial_duration) {
              // Show trial duration (e.g., "1 Day", "7 Days")
              const unit = product.trial_duration_unit || 'days';
              const singularUnit = unit.toLowerCase().endsWith('s') ? unit.slice(0, -1) : unit;
              displayTerm = `${product.trial_duration} ${product.trial_duration === 1 ? singularUnit : unit}`;
            } else {
              // Show regular pricing term
              displayTerm = `${term} ${parseInt(term) === 1 ? 'Month' : 'Months'}`;
            }
            
            return (
              <button
                key={term}
                onClick={() => handleAddToCart(parseInt(term), price)}
                className="w-full flex justify-between items-center bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 p-4 rounded-lg transition border border-gray-200 dark:border-gray-600 hover:border-blue-300"
              >
                <span className="font-semibold capitalize dark:text-white">
                  {displayTerm}
                </span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {product.is_trial && parseFloat(price) === 0 ? 'FREE' : `$${price}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
