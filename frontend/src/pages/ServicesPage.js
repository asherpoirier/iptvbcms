import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { servicesAPI, productsAPI } from '../api/api';
import { useCartStore } from '../store/store';
import { ArrowLeft, Tv, Copy, Check, Eye, EyeOff, Package, X } from 'lucide-react';

export default function ServicesPage() {
  const navigate = useNavigate();
  
  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await servicesAPI.getAll();
      return response.data;
    },
  });

  // Fetch products for renewal pricing
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await productsAPI.getAll();
      return response.data;
    },
  });

  // Fetch refunds setting (public endpoint, no auth required)
  const { data: refundsData, isLoading: refundsLoading } = useQuery({
    queryKey: ['refunds-enabled'],
    queryFn: async () => {
      // Use axios directly without auth interceptor for public endpoint
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/refunds/enabled`);
      return response.json();
    },
  });

  // Show button if loading (optimistic) or if explicitly enabled
  const refundsEnabled = refundsLoading || refundsData?.enabled === true;
  
  // Debug log
  console.log('Refunds loading:', refundsLoading, 'Refunds data:', refundsData, 'Button visible:', refundsEnabled);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <header className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">My Services</h1>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (() => {
          // Filter out credit add-ons (only show main reseller accounts and subscribers)
          const mainServices = services?.filter(s => !s.is_credit_addon) || [];
          
          return mainServices.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center">
              <Tv className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No services yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Purchase a subscription to get started</p>
              <Link to="/" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                Browse Products
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {mainServices.map((service) => (
                <ServiceCard key={service.id} service={service} navigate={navigate} products={products} refundsEnabled={refundsEnabled} />
              ))}
            </div>
          );
        })()}
      </main>
    </div>
  );
}

function ServiceCard({ service, navigate, products, refundsEnabled }) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const { addRenewalItem } = useCartStore();
  
  const handleRenew = () => {
    // Find the product and get correct price
    const product = products?.find(p => p.id === service.product_id);
    
    if (product) {
      const term = service.term_months || 1;
      const price = product.prices?.[term] || 0;
      
      // Add as renewal item with extend action (from services page always extends)
      addRenewalItem({
        product_id: service.product_id,
        product_name: service.product_name,
        term_months: term,
        price: price,
        account_type: service.account_type
      }, service.id, 'extend');
      
      // Redirect to checkout
      navigate('/checkout');
    } else {
      alert('Product not found. Please contact support.');
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'refunded':
        return 'bg-gray-400 text-gray-800 dark:bg-gray-600 dark:text-gray-200';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className={`rounded-lg shadow-lg overflow-hidden ${
      service.status === 'refunded' 
        ? 'bg-gray-200 dark:bg-gray-800 opacity-75' 
        : 'bg-white dark:bg-gray-900'
    } ${
      service.account_type === 'reseller' ? 'border-2 border-purple-200 dark:border-purple-700' : ''
    }`}>
      <div className={`bg-gradient-to-r ${
        service.status === 'refunded'
          ? 'from-gray-500 to-gray-600'
          : service.account_type === 'reseller' 
            ? 'from-purple-600 to-purple-700' 
            : 'from-blue-600 to-blue-700'
      } p-6 text-white`}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              {service.account_type === 'reseller' 
                ? (service.panel_name || `Server ${(service.panel_index || 0) + 1}`)
                : service.product_name
              }
            </h2>
            <p className={service.account_type === 'reseller' ? 'text-purple-100' : 'text-blue-100'}>
              {service.account_type === 'subscriber' ? 'Subscriber Account' : 'Reseller Panel'}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(service.status)}`}>
            {service.status}
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Connection Details */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {service.account_type === 'reseller' ? 'Reseller Panel Access' : 'Connection Details'}
            </h3>
            <div className="space-y-3">
              {/* Panel URL for resellers */}
              {service.account_type === 'reseller' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Panel URL</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-sm font-mono break-all">
                      {service.panel_url || 'Contact support for panel URL'}
                    </code>
                    {service.panel_url && (
                      <button
                        onClick={() => copyToClipboard(service.panel_url, 'panelurl')}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600"
                      >
                        {copied === 'panelurl' ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Username</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-sm font-mono">
                    {service.xtream_username || 'N/A'}
                  </code>
                  <button
                    onClick={() => copyToClipboard(service.xtream_username, 'username')}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600"
                  >
                    {copied === 'username' ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Password</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-sm font-mono">
                    {showPassword ? service.xtream_password : '••••••••'}
                  </code>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(service.xtream_password, 'password')}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600"
                  >
                    {copied === 'password' ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Service Info (only for subscribers) */}
          {service.account_type === 'subscriber' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Service Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Max Connections</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{service.max_connections || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Expiry Date</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {service.expiry_date ? new Date(service.expiry_date).toLocaleDateString() : 'Lifetime'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Renew and Refund buttons for active subscribers only */}
        {service.account_type === 'subscriber' && service.status === 'active' && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <button
              onClick={handleRenew}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              <Package className="w-5 h-5" />
              Renew Service
            </button>
            {refundsEnabled && (
              <button
                onClick={() => setShowRefundModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
              >
                Request Refund
              </button>
            )}
          </div>
        )}
        
        {/* Refunded status message */}
        {service.status === 'refunded' && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-center">
              <p className="text-gray-700 dark:text-gray-300 font-semibold">
                💰 This service has been refunded
              </p>
              {service.refund_reason && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Reason: {service.refund_reason}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Setup Instructions (only for subscribers) */}
        {service.account_type !== 'reseller' && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Setup Instructions</h3>
            {service.setup_instructions ? (
              <div className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                {service.setup_instructions}
              </div>
            ) : (
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-200">
                <li>Download an IPTV player (IPTV Smarters Pro, TiviMate, etc.)</li>
                <li>Enter the server URL, username, and password above</li>
                <li>Start watching your favorite channels!</li>
              </ol>
            )}
          </div>
        )}
      </div>
      
      {/* Refund Request Modal */}
      {showRefundModal && (
        <RefundRequestModal
          service={service}
          onClose={() => setShowRefundModal(false)}
        />
      )}
    </div>
  );
}

// Refund Request Modal Component
function RefundRequestModal({ service, onClose }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      alert('Please provide a reason for the refund request');
      return;
    }

    setSubmitting(true);
    
    try {
      // Get the product to find the actual price paid
      // For now, request the full order amount (backend will validate)
      // We'll use a reasonable default amount
      const refundAmount = 10.00; // Default amount, backend will validate against actual order
      
      await servicesAPI.requestRefund(service.order_id, refundAmount, reason);
      alert('Refund request submitted successfully! Our team will review it shortly.');
      onClose();
      window.location.reload(); // Refresh to show updated status
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      alert('Failed to submit refund request: ' + errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Request Refund</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Service:</strong> {service.product_name}<br />
              <strong>Username:</strong> {service.xtream_username}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason for Refund *
            </label>
            <textarea
              required
              rows="4"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why you're requesting a refund..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Your refund request will be reviewed by our team. You'll be notified via email once a decision is made.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
