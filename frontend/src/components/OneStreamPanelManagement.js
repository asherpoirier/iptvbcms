import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Save, Plus, Trash2, Server, X, Check, Package, Users } from 'lucide-react';

export default function OneStreamPanelManagement({ settings }) {
  const queryClient = useQueryClient();
  const [panels, setPanels] = useState(settings?.onestream?.panels || []);
  const [showModal, setShowModal] = useState(false);
  const [editingPanel, setEditingPanel] = useState(null);
  const [testingPanelId, setTestingPanelId] = useState(null);
  const [syncingPackages, setSyncingPackages] = useState(null);
  const [syncingBouquets, setSyncingBouquets] = useState(null);
  const [syncingUsers, setSyncingUsers] = useState(null);

  const updateMutation = useMutation({
    mutationFn: (data) => {
      const settingsUpdate = { ...settings, onestream: { panels: data } };
      return adminAPI.updateSettings(settingsUpdate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-settings']);
      alert('1-Stream panels saved successfully!');
    },
  });

  const testMutation = useMutation({
    mutationFn: () => adminAPI.testOneStream(),
    onSuccess: (response) => {
      alert(response.data?.message || 'Connection successful!');
      setTestingPanelId(null);
    },
    onError: (error) => {
      alert('Connection failed: ' + (error.response?.data?.detail || 'Unknown error'));
      setTestingPanelId(null);
    },
  });

  const handleSave = () => updateMutation.mutate(panels);

  const handleAddPanel = (panelData) => {
    if (editingPanel !== null) {
      const updated = [...panels];
      updated[editingPanel] = panelData;
      setPanels(updated);
    } else {
      setPanels([...panels, panelData]);
    }
    setShowModal(false);
    setEditingPanel(null);
  };

  const handleRemovePanel = (index) => {
    if (window.confirm('Remove this 1-Stream panel? Users from this panel will be removed on next sync.')) {
      setPanels(panels.filter((_, i) => i !== index));
    }
  };

  const handleSyncPackages = async (index) => {
    setSyncingPackages(index);
    try {
      const response = await adminAPI.syncOneStreamPackages(index);
      const count = response.data?.count || 0;
      const trialCount = response.data?.trial_count || 0;
      alert(`Synced from ${response.data?.panel_name || 'panel'}:\n${count} regular packages\n${trialCount} trial packages`);
    } catch (error) {
      alert('Sync failed: ' + (error.response?.data?.detail || 'Unknown error'));
    }
    setSyncingPackages(null);
  };

  const handleSyncBouquets = async (index) => {
    setSyncingBouquets(index);
    try {
      const response = await adminAPI.syncOneStreamBouquets(index);
      alert(`Synced ${response.data?.count || 0} bouquets`);
    } catch (error) {
      alert('Sync failed: ' + (error.response?.data?.detail || 'Unknown error'));
    }
    setSyncingBouquets(null);
  };

  const handleSyncUsers = async (index) => {
    setSyncingUsers(index);
    try {
      const response = await adminAPI.syncOneStreamUsers(index);
      alert(`Synced from ${response.data?.panel_name || 'panel'}:\n${response.data?.synced || 0} new users\n${response.data?.updated || 0} updated`);
    } catch (error) {
      alert('Sync failed: ' + (error.response?.data?.detail || 'Unknown error'));
    }
    setSyncingUsers(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">1-Stream Panels</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure connections to your 1-Stream IPTV panels using the B2B Billing API
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingPanel(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" /> Add Panel
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Save className="w-5 h-5" /> {updateMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {panels.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Server className="w-16 h-16 mx-auto mb-4 opacity-40" />
          <h3 className="text-xl font-semibold mb-2">No 1-Stream Panels</h3>
          <p>Add your first 1-Stream panel to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {panels.map((panel, index) => (
            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Server className="w-5 h-5 text-indigo-600" />
                    {panel.name || `1-Stream Panel ${index + 1}`}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">{panel.panel_url}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    API Key: {panel.api_key ? '****' + panel.api_key.slice(-4) : 'Not set'} |
                    Auth Token: {panel.auth_user_token ? '****' + panel.auth_user_token.slice(-4) : 'Not set'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingPanel(index); setShowModal(true); }}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemovePanel(index)}
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => { setTestingPanelId(index); testMutation.mutate(); }}
                  disabled={testingPanelId === index}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {testingPanelId === index ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  onClick={() => handleSyncPackages(index)}
                  disabled={syncingPackages === index}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-50"
                >
                  <Package className="w-4 h-4" />
                  {syncingPackages === index ? 'Syncing...' : 'Sync Packages'}
                </button>
                <button
                  onClick={() => handleSyncBouquets(index)}
                  disabled={syncingBouquets === index}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50"
                >
                  <Package className="w-4 h-4" />
                  {syncingBouquets === index ? 'Syncing...' : 'Sync Bouquets'}
                </button>
                <button
                  onClick={() => handleSyncUsers(index)}
                  disabled={syncingUsers === index}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50"
                >
                  <Users className="w-4 h-4" />
                  {syncingUsers === index ? 'Syncing...' : 'Sync Users'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PanelModal
          panel={editingPanel !== null ? panels[editingPanel] : null}
          onClose={() => { setShowModal(false); setEditingPanel(null); }}
          onSave={handleAddPanel}
        />
      )}
    </div>
  );
}

function PanelModal({ panel, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: panel?.name || '',
    panel_url: panel?.panel_url || '',
    api_key: panel?.api_key || '',
    auth_user_token: panel?.auth_user_token || '',
    ssl_verify: panel?.ssl_verify || false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.panel_url || !formData.api_key || !formData.auth_user_token) {
      alert('All fields are required');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {panel ? 'Edit 1-Stream Panel' : 'Add 1-Stream Panel'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Panel Name *</label>
            <input
              type="text" required value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My 1-Stream Panel"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Panel URL *</label>
            <input
              type="url" required value={formData.panel_url}
              onChange={(e) => setFormData({ ...formData, panel_url: e.target.value })}
              placeholder="http://panel.example.com:8080"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Base URL of the 1-Stream panel (with port if needed)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API Key (X-Api-Key) *</label>
            <input
              type="password" required value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              placeholder="Admin API access token"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Generated by admin in panel: Settings &gt; API Access Tokens
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">User Auth Token (X-Auth-User) *</label>
            <input
              type="password" required value={formData.auth_user_token}
              onChange={(e) => setFormData({ ...formData, auth_user_token: e.target.value })}
              placeholder="User-specific auth token"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Generated from user profile page. Needs permissions: showUserProfile, indexPackages, createLinesWithPackage, destroyLines, statusLineToggle, indexLines
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Setup Guide:</strong> In your 1-Stream admin panel, create an API Access Token (Settings &gt; API Access), then generate a User Auth Token from the user profile. Both tokens are required for API access.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold">
              {panel ? 'Update Panel' : 'Add Panel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
