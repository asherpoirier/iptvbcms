import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Eye, EyeOff } from 'lucide-react';
import api from '../api/api';

export default function RecaptchaSettings({ settings }) {
  const queryClient = useQueryClient();
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [formData, setFormData] = useState({
    enabled: settings?.recaptcha?.enabled || false,
    site_key: settings?.recaptcha?.site_key || '6Ld3k10sAAAAAARRcgB5g_oMaPnZAf-QYTaGPOgm',
    secret_key: settings?.recaptcha?.secret_key || '6Ld3k10sAAAAADqYygjrbMeostUHLzZkHSzbRTld',
    customer_score_threshold: settings?.recaptcha?.customer_score_threshold || 0.5,
    admin_score_threshold: settings?.recaptcha?.admin_score_threshold || 0.7,
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const settingsUpdate = {
        ...settings,
        recaptcha: data
      };
      return api.put('/api/admin/settings', settingsUpdate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-settings']);
      alert('reCAPTCHA settings saved successfully!');
    },
    onError: (error) => {
      alert('Failed to save settings: ' + (error.response?.data?.detail || error.message));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          Google reCAPTCHA v3
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Protect login forms from bots with invisible reCAPTCHA verification
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">Enable reCAPTCHA Protection</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Verify all login attempts with Google reCAPTCHA</p>
        </div>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            formData.enabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            formData.enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>Site Key (Public):</strong> The site key is already configured. Get your secret key from Google reCAPTCHA Admin Console.
        </p>
        <a
          href="https://www.google.com/recaptcha/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-700 underline mt-2 inline-block"
        >
          Open reCAPTCHA Admin Console →
        </a>
      </div>

      {/* Site Key */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Site Key (Public)
        </label>
        <input
          type="text"
          value={formData.site_key}
          onChange={(e) => setFormData({ ...formData, site_key: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
          placeholder="6Le..."
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Visible to users, safe to expose</p>
      </div>

      {/* Secret Key */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Secret Key (Confidential)
        </label>
        <div className="relative">
          <input
            type={showSecretKey ? 'text' : 'password'}
            value={formData.secret_key}
            onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
            className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
            placeholder="6Le..."
          />
          <button
            type="button"
            onClick={() => setShowSecretKey(!showSecretKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {showSecretKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-semibold">
          ⚠️ Keep this secret. Never share or expose this key.
        </p>
      </div>

      {/* Score Thresholds */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Customer Score Threshold: {formData.customer_score_threshold.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={formData.customer_score_threshold}
            onChange={(e) => setFormData({ ...formData, customer_score_threshold: parseFloat(e.target.value) })}
            className="w-full"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Higher = stricter (0.5 = balanced)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Admin Score Threshold: {formData.admin_score_threshold.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={formData.admin_score_threshold}
            onChange={(e) => setFormData({ ...formData, admin_score_threshold: parseFloat(e.target.value) })}
            className="w-full"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Higher = stricter (0.7 = recommended)
          </p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Score Guide:</h5>
        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
          <p>• <strong>0.9 - 1.0:</strong> Very likely legitimate user</p>
          <p>• <strong>0.5 - 0.9:</strong> Possibly legitimate (default threshold)</p>
          <p>• <strong>0.0 - 0.5:</strong> Very likely bot traffic (blocked)</p>
        </div>
      </div>

      <button
        type="submit"
        disabled={updateMutation.isLoading}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
      >
        {updateMutation.isLoading ? 'Saving...' : 'Save reCAPTCHA Settings'}
      </button>
    </form>
  );
}
