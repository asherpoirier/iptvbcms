import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../api/api';
import { Shield, Key, AlertCircle, ExternalLink, CheckCircle } from 'lucide-react';

export default function LicenseActivationRequired() {
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');

  const { data: licenseStatus, refetch } = useQuery({
    queryKey: ['license-check'],
    queryFn: async () => {
      const response = await api.get('/api/license/status');
      return response.data;
    },
    refetchInterval: 10000,
  });

  const activateLicense = async (e) => {
    e.preventDefault();
    setError('');
    setActivating(true);

    try {
      // Call API to save license key to settings
      const response = await api.post('/api/admin/activate-license', {
        license_key: licenseKey
      });

      if (response.data.valid) {
        alert('✅ License activated successfully!\n\nReloading application...');
        window.location.reload();
      } else {
        setError(response.data.reason || 'Invalid license key');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to activate license. Please check the key and try again.');
    } finally {
      setActivating(false);
    }
  };

  // Auto-reload if license becomes valid
  useEffect(() => {
    if (licenseStatus?.licensed) {
      window.location.reload();
    }
  }, [licenseStatus]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 p-8 text-white text-center">
            <Shield className="w-20 h-20 mx-auto mb-4 opacity-90" />
            <h1 className="text-3xl font-bold mb-2">License Activation Required</h1>
            <p className="text-red-100">This application requires a valid license key to operate</p>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-red-900 dark:text-red-200 text-lg mb-2">
                    No Valid License Detected
                  </h3>
                  <p className="text-red-800 dark:text-red-300 text-sm">
                    {licenseStatus?.message || 'No license key configured for this installation.'}
                  </p>
                </div>
              </div>
            </div>

            {/* License Activation Form */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Key className="w-6 h-6 text-blue-600" />
                <h3 className="font-bold text-blue-900 dark:text-blue-200 text-lg">
                  Activate Your License
                </h3>
              </div>

              <form onSubmit={activateLicense}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    License Key
                  </label>
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    pattern="[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={activating}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Enter the license key provided by your vendor
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={activating || !licenseKey}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {activating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Activating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Activate License
                    </>
                  )}
                </button>
              </form>

              <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
                License will be validated instantly. If valid, the application will unlock automatically.
              </p>
            </div>

            {/* Instructions */}
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Alternative: Manual Activation
                </h3>
                <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center font-bold text-xs">1</span>
                    <span>Add to <code className="bg-gray-100 px-1 rounded">/app/backend/.env</code> file:
                      <br />
                      <code className="block bg-gray-900 text-green-400 p-2 rounded mt-1 font-mono text-xs">
                        LICENSE_KEY=XXXX-XXXX-XXXX-XXXX
                      </code>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center font-bold text-xs">2</span>
                    <span>Restart the backend: <code className="bg-gray-100 px-1 rounded">supervisorctl restart backend</code></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center font-bold text-xs">3</span>
                    <span>Refresh this page - application will unlock</span>
                  </li>
                </ol>
              </div>

              {/* Contact */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">Need a License?</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  Contact us on Telegram to purchase a license for your domain.
                </p>
                <a
                  href="https://t.me/iptvbilling"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121L7.944 13.3l-2.893-.903c-.628-.198-.64-.628.135-.931l11.302-4.36c.52-.17.976.124.806.815z"/>
                  </svg>
                  Chat on Telegram
                </a>
              </div>

              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  License status checks automatically every 10 seconds
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-gray-400 text-sm">
            Application Version 1.0 • Protected by License System
          </p>
        </div>
      </div>
    </div>
  );
}
