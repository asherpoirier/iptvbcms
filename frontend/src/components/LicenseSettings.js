import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Save, Key, CheckCircle, XCircle, AlertCircle, Shield } from 'lucide-react';
import api from '../api/api';

export default function LicenseSettings({ settings }) {
  const queryClient = useQueryClient();
  const [licenseKey, setLicenseKey] = useState(settings?.license_key || '');

  const { data: licenseStatus } = useQuery({
    queryKey: ['license-status'],
    queryFn: async () => {
      const response = await api.get('/api/license/status');
      return response.data;
    },
    refetchInterval: 60000, // Check every minute
  });

  const updateMutation = useMutation({
    mutationFn: (data) => {
      const settingsUpdate = {
        ...settings,
        license_key: data.license_key
      };
      return adminAPI.updateSettings(settingsUpdate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-settings']);
      queryClient.invalidateQueries(['license-status']);
      alert('License key saved! Please restart the application for changes to take effect.');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate({ license_key: licenseKey });
  };

  const getStatusIcon = () => {
    if (!licenseStatus) return <AlertCircle className="w-12 h-12 text-gray-400" />;
    
    if (licenseStatus.licensed) {
      return <CheckCircle className="w-12 h-12 text-green-600" />;
    } else {
      return <XCircle className="w-12 h-12 text-red-600" />;
    }
  };

  const getStatusColor = () => {
    if (!licenseStatus) return 'bg-gray-100 text-gray-800';
    
    if (licenseStatus.licensed) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    } else {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* License Status Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-4">
          <Shield className="w-16 h-16 text-white opacity-90" />
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-1">Application License</h3>
            <p className="text-blue-100">
              {licenseStatus?.licensed 
                ? `Licensed to: ${licenseStatus.customer || 'Valid License'}`
                : 'Activate your license key to unlock full features'
              }
            </p>
          </div>
          <div className="text-right">
            <span className={`px-4 py-2 rounded-full font-bold ${getStatusColor()}`}>
              {licenseStatus?.mode || 'CHECKING...'}
            </span>
          </div>
        </div>
      </div>

      {/* Current Status */}
      {licenseStatus && (
        <div className={`p-6 rounded-lg border-2 ${
          licenseStatus.licensed 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
        }`}>
          <div className="flex items-start gap-4">
            {getStatusIcon()}
            <div className="flex-1">
              <h4 className={`font-bold text-lg mb-2 ${
                licenseStatus.licensed ? 'text-green-900 dark:text-green-200' : 'text-yellow-900 dark:text-yellow-200'
              }`}>
                {licenseStatus.licensed ? 'License Active' : 'License Not Active'}
              </h4>
              <p className={`text-sm ${
                licenseStatus.licensed ? 'text-green-800 dark:text-green-300' : 'text-yellow-800 dark:text-yellow-300'
              }`}>
                {licenseStatus.message}
              </p>
              
              {licenseStatus.expiry_date && (
                <p className="text-sm mt-2">
                  <strong>Expires:</strong> {new Date(licenseStatus.expiry_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* License Key Input */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">License Key</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Enter Your License Key
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-lg"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              pattern="[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}"
              data-testid="license-key-input"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Format: XXXX-XXXX-XXXX-XXXX (16 characters with dashes)
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
            <p className="text-sm text-blue-900 dark:text-blue-200 mb-2">
              <strong>Don't have a license key?</strong>
            </p>
            <p className="text-xs text-blue-800 dark:text-blue-300">
              Contact support to purchase a license for your domain. Each license is tied to your specific domain for security.
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={updateMutation.isLoading || !licenseKey}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              data-testid="save-license-btn"
            >
              <Save className="w-5 h-5" />
              {updateMutation.isLoading ? 'Saving...' : 'Save License Key'}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              ⚠️ Application must be restarted after saving for the license to take effect.
            </p>
          </div>
        </div>
      </form>

      {/* How to Activate */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <h4 className="font-bold text-gray-900 dark:text-white mb-3">How to Activate Your License</h4>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>Enter your license key in the field above</li>
          <li>Click "Save License Key"</li>
          <li>Add LICENSE_KEY to your environment variables (or .env file)</li>
          <li>Restart your backend server</li>
          <li>Check the status above - it should show "LICENSED"</li>
        </ol>
      </div>
    </div>
  );
}
