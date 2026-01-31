import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Save, Plus, Edit, Trash2, Server, X, Check, Package, BookOpen, Users } from 'lucide-react';

export default function XuiOnePanelManagement({ settings }) {
  const queryClient = useQueryClient();
  const [panels, setPanels] = useState(settings?.xuione?.panels || []);
  const [showModal, setShowModal] = useState(false);
  const [editingPanel, setEditingPanel] = useState(null);
  const [testingPanelId, setTestingPanelId] = useState(null);
  const [syncingPackages, setSyncingPackages] = useState(null);
  const [syncingBouquets, setSyncingBouquets] = useState(null);
  const [syncingUsers, setSyncingUsers] = useState(null);

  const updateMutation = useMutation({
    mutationFn: (data) => {
      const settingsUpdate = {
        ...settings,
        xuione: { panels: data }
      };
      return adminAPI.updateSettings(settingsUpdate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-settings']);
      alert('XuiOne panels saved successfully!');
    },
  });

  const testMutation = useMutation({
    mutationFn: () => adminAPI.testXuiOne(),
    onSuccess: () => {
      alert('Connection successful!');
      setTestingPanelId(null);
    },
    onError: (error) => {
      alert('Connection failed: ' + (error.response?.data?.error || 'Unknown error'));
      setTestingPanelId(null);
    },
  });

  const syncPackagesMutation = useMutation({
    mutationFn: (panelIndex) => adminAPI.syncXuiOnePackages(panelIndex),
    onSuccess: (response, panelIndex) => {
      const regularCount = response.data?.count || 0;
      const trialCount = response.data?.trial_count || 0;
      const panelName = response.data?.panel_name || 'panel';
      alert(`✓ Synced from ${panelName}:\n• ${regularCount} regular packages\n• ${trialCount} trial packages`);
      setSyncingPackages(null);
    },
    onError: (error, panelIndex) => {
      alert('Sync failed: ' + (error.response?.data?.detail || 'Unknown error'));
      setSyncingPackages(null);
    },
  });

  const syncBouquetsMutation = useMutation({
    mutationFn: (panelIndex) => adminAPI.syncXuiOneBouquets(panelIndex),
    onSuccess: (response, panelIndex) => {
      const count = response.data?.bouquets?.length || 0;
      const panelName = response.data?.panel_name || 'panel';
      alert(`✓ Synced ${count} bouquets from ${panelName}!`);
      setSyncingBouquets(null);
    },
    onError: (error, panelIndex) => {
      alert('Sync failed: ' + (error.response?.data?.detail || 'Unknown error'));
      setSyncingBouquets(null);
    },
  });

  const syncUsersMutation = useMutation({
    mutationFn: (panelIndex) => adminAPI.syncXuiOneUsers(panelIndex),
    onSuccess: (response, panelIndex) => {
      const syncedCount = response.data?.synced || 0;
      const updatedCount = response.data?.updated || 0;
      const removedCount = response.data?.removed || 0;
      const panelName = response.data?.panel_name || 'panel';
      alert(`✓ User sync from ${panelName} complete:\n• ${syncedCount} new users imported\n• ${updatedCount} existing users updated\n• ${removedCount} users removed (no longer exist on panel)`);
      setSyncingUsers(null);
    },
    onError: (error, panelIndex) => {
      alert(`Failed to sync users: ${error.response?.data?.detail || error.message}`);
      setSyncingUsers(null);
    },
  });

  const handleAddPanel = () => {
    setEditingPanel({
      name: '',
      panel_url: '',
      api_key: '',
      admin_username: '',
      admin_password: '',
      ssl_verify: false,
      active: true
    });
    setShowModal(true);
  };

  const handleEditPanel = (panel, index) => {
    setEditingPanel({ ...panel, index });
    setShowModal(true);
  };

  const handleDeletePanel = (index) => {
    if (window.confirm('Delete this panel? This cannot be undone.')) {
      const newPanels = panels.filter((_, i) => i !== index);
      setPanels(newPanels);
      updateMutation.mutate(newPanels);
    }
  };

  const handleSavePanel = (panelData) => {
    let newPanels;
    if (panelData.index !== undefined) {
      // Edit existing
      newPanels = [...panels];
      newPanels[panelData.index] = panelData;
    } else {
      // Add new
      newPanels = [...panels, panelData];
    }
    
    setPanels(newPanels);
    updateMutation.mutate(newPanels);
    setShowModal(false);
    setEditingPanel(null);
  };

  const handleSyncUsers = (index) => {
    setSyncingUsers(index);
    syncUsersMutation.mutate(index);
  };

  const handleTestPanel = (panel, index) => {
    setTestingPanelId(index);
    testMutation.mutate();
  };

  const handleSyncPackages = (index) => {
    setSyncingPackages(index);
    syncPackagesMutation.mutate(index);
  };

  const handleSyncBouquets = (index) => {
    setSyncingBouquets(index);
    syncBouquetsMutation.mutate(index);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">XuiOne Panels</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage XuiOne panel connections with API key authentication
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddPanel}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          data-testid="add-xuione-panel-btn"
        >
          <Plus className="w-5 h-5" />
          Add Panel
        </button>
      </div>

      {/* Panels List */}
      <div className="space-y-3">
        {panels.map((panel, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4" data-testid={`xuione-panel-${index}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{panel.name}</h4>
                  {panel.active ? (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <p><strong>Panel URL:</strong> {panel.panel_url}</p>
                  <p><strong>API Access Code:</strong> {panel.api_access_code || 'Not set'}</p>
                  <p><strong>API Key:</strong> {panel.api_key ? '••••••••' + panel.api_key.slice(-4) : 'Not set'}</p>
                  <p><strong>Username:</strong> {panel.admin_username || 'Not set'}</p>
                  <p><strong>Password:</strong> {panel.admin_password ? '••••••••' : 'Not set'}</p>
                </div>
                
                {/* Action buttons for each panel */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={() => handleTestPanel(panel, index)}
                    disabled={testingPanelId === index}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50 border border-blue-200"
                    title="Test Connection"
                    data-testid={`test-xuione-panel-${index}`}
                  >
                    <Server className="w-4 h-4" />
                    {testingPanelId === index ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    onClick={() => handleSyncPackages(index)}
                    disabled={syncingPackages === index}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50 border border-green-200"
                    title="Sync Packages"
                    data-testid={`sync-xuione-packages-${index}`}
                  >
                    <Package className="w-4 h-4" />
                    {syncingPackages === index ? 'Syncing...' : 'Sync Packages'}
                  </button>
                  <button
                    onClick={() => handleSyncBouquets(index)}
                    disabled={syncingBouquets === index}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 border border-purple-200"
                    title="Sync Bouquets"
                    data-testid={`sync-xuione-bouquets-${index}`}
                  >
                    <BookOpen className="w-4 h-4" />
                    {syncingBouquets === index ? 'Syncing...' : 'Sync Bouquets'}
                  </button>
                  <button
                    onClick={() => handleSyncUsers(index)}
                    disabled={syncingUsers === index}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 disabled:opacity-50 border border-indigo-200"
                    title="Sync Users"
                    data-testid={`sync-xuione-users-${index}`}
                  >
                    <Users className="w-4 h-4" />
                    {syncingUsers === index ? 'Syncing...' : 'Sync Users'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditPanel(panel, index)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                  title="Edit"
                  data-testid={`edit-xuione-panel-${index}`}
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDeletePanel(index)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Delete"
                  data-testid={`delete-xuione-panel-${index}`}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {panels.length === 0 && (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
            <Server className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-300 mb-4">No XuiOne panels configured</p>
            <button
              onClick={handleAddPanel}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Your First XuiOne Panel
            </button>
          </div>
        )}
      </div>

      {/* Panel Form Modal */}
      {showModal && (
        <XuiOnePanelFormModal
          panel={editingPanel}
          onClose={() => {
            setShowModal(false);
            setEditingPanel(null);
          }}
          onSave={handleSavePanel}
        />
      )}
    </div>
  );
}

function XuiOnePanelFormModal({ panel, onClose, onSave }) {
  const [formData, setFormData] = useState(panel || {
    name: '',
    panel_url: '',
    api_access_code: '',
    api_key: '',
    admin_username: '',
    admin_password: '',
    ssl_verify: false,
    active: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="xuione-panel-modal">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {panel.index !== undefined ? 'Edit XuiOne Panel' : 'Add New XuiOne Panel'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Panel Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="Main XuiOne Panel, etc."
              data-testid="xuione-panel-name-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Panel URL *
            </label>
            <input
              type="url"
              required
              value={formData.panel_url}
              onChange={(e) => setFormData({ ...formData, panel_url: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="https://yourxuione.com:port"
              data-testid="xuione-panel-url-input"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              API endpoint for XuiOne panel management
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Access Code
            </label>
            <input
              type="text"
              value={formData.api_access_code}
              onChange={(e) => setFormData({ ...formData, api_access_code: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., UfPJlfai"
              data-testid="xuione-api-access-code-input"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              API access code from XuiOne admin profile (different from web access)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key
            </label>
            <input
              type="text"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="Your XuiOne API Key (optional)"
              data-testid="xuione-api-key-input"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              API key for authentication (if supported by your panel)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username *
            </label>
            <input
              type="text"
              required
              value={formData.admin_username}
              onChange={(e) => setFormData({ ...formData, admin_username: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="username"
              data-testid="xuione-username-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password *
            </label>
            <input
              type="password"
              required
              value={formData.admin_password}
              onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="password"
              data-testid="xuione-password-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="xuione-active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              data-testid="xuione-active-checkbox"
            />
            <label htmlFor="xuione-active" className="text-sm text-gray-700 dark:text-gray-300">
              Active (use this panel for new products)
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              data-testid="xuione-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
              data-testid="xuione-save-btn"
            >
              {panel.index !== undefined ? 'Update Panel' : 'Add Panel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
