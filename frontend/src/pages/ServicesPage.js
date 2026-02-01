import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { servicesAPI } from '../api/api';
import { ArrowLeft, Tv, Copy, Check, Eye, EyeOff } from 'lucide-react';

export default function ServicesPage() {
  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await servicesAPI.getAll();
      return response.data;
    },
  });

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
        ) : services?.length === 0 ? (
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
            {services?.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ServiceCard({ service }) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(null);

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2">{service.product_name}</h2>
            <p className="text-blue-100">{service.account_type === 'subscriber' ? 'Subscriber Account' : 'Reseller Account'}</p>
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Connection Details</h3>
            <div className="space-y-3">
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

          {/* Service Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Service Information</h3>
            <div className="space-y-3">
              {service.account_type === 'subscriber' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Max Connections</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">{service.max_connections || 'N/A'}</p>
                </div>
              )}
              {service.account_type === 'reseller' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Credits</label>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">${service.reseller_credits || 0}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Max Lines</label>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">{service.reseller_max_lines || 'N/A'}</p>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Expiry Date</label>
                <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                  {service.expiry_date ? new Date(service.expiry_date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Setup Instructions */}
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
      </div>
    </div>
  );
}
