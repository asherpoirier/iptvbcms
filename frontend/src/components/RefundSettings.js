import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { DollarSign, Save } from 'lucide-react';

export default function RefundSettings({ settings }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(settings?.refunds_enabled ?? true);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const settingsUpdate = {
        ...settings,
        refunds_enabled: data.enabled
      };
      return adminAPI.updateSettings(settingsUpdate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-settings']);
      alert('Refund settings saved successfully!');
    },
    onError: (error) => {
      alert('Failed to save settings: ' + (error.response?.data?.detail || error.message));
    }
  });

  const handleSave = () => {
    saveMutation.mutate({ enabled });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Refund Settings</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Control whether customers can request refunds for their services
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-6 h-6 text-blue-600" />
              <h4 className="font-semibold text-gray-900 dark:text-white">Customer Refund Requests</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              When enabled, customers can request refunds for their active services from the "My Services" page. 
              Admins can review and approve/reject requests from the Refunds page.
            </p>
            
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="refunds-enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="refunds-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {enabled ? '✓ Refund requests enabled' : '✗ Refund requests disabled'}
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className={`border rounded-lg p-4 ${
        enabled 
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}>
        <p className={`text-sm ${
          enabled
            ? 'text-green-800 dark:text-green-300'
            : 'text-gray-600 dark:text-gray-400'
        }`}>
          {enabled ? (
            <>
              <strong>Status:</strong> Customers can request refunds. The "Request Refund" button will appear on active service cards.
            </>
          ) : (
            <>
              <strong>Status:</strong> Refund requests are disabled. Customers will not see the "Request Refund" button.
            </>
          )}
        </p>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saveMutation.isLoading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-300">
          <strong>Note:</strong> Disabling refunds will only hide the request button from customers. 
          Existing refund requests can still be processed from the admin Refunds page.
        </p>
      </div>
    </div>
  );
}
