import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import api from '../api/api';
import { Save, Plus, Trash2, Shield, X, Check, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

export default function GhostSurfPanelManagement({ settings }) {
  const queryClient = useQueryClient();
  const [panels, setPanels] = useState(settings?.ghostsurf?.panels || []);
  const [showModal, setShowModal] = useState(false);
  const [editingPanel, setEditingPanel] = useState(null);
  const [testingPanel, setTestingPanel] = useState(null);
  const [syncingPanel, setSyncingPanel] = useState(null);

  React.useEffect(() => {
    const serverPanels = settings?.ghostsurf?.panels || [];
    if (serverPanels.length > 0) setPanels(serverPanels);
  }, [settings?.ghostsurf?.panels]);

  const updateMutation = useMutation({
    mutationFn: (data) => {
      const settingsUpdate = { ...settings, ghostsurf: { panels: data } };
      return adminAPI.updateSettings(settingsUpdate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-settings']);
      toast.success('GhostSurf panels saved!');
    },
    onError: (error) => toast.error('Failed to save: ' + (error.response?.data?.detail || error.message)),
  });

  const testMutation = useMutation({
    mutationFn: () => api.post('/api/admin/ghostsurf/test'),
    onSuccess: (response) => {
      toast.success(response.data?.message || 'Connection successful!');
      setTestingPanel(null);
    },
    onError: (error) => {
      toast.error('Connection failed: ' + (error.response?.data?.detail || 'Unknown error'));
      setTestingPanel(null);
    },
  });

  const syncUsersMutation = useMutation({
    mutationFn: (panelIndex) => api.post(`/api/admin/ghostsurf/sync-users/${panelIndex}`),
    onSuccess: (response) => {
      toast.success(response.data?.message || 'Users synced!');
      setSyncingPanel(null);
    },
    onError: (error) => {
      toast.error('Sync failed: ' + (error.response?.data?.detail || 'Unknown error'));
      setSyncingPanel(null);
    },
  });

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
    if (window.confirm('Remove this GhostSurf panel?')) {
      const updated = panels.filter((_, i) => i !== index);
      setPanels(updated);
      updateMutation.mutate(updated);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">GhostSurf VPN Panels</h3>
      </div>

      {panels.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">No GhostSurf VPN panels configured</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Add a panel to start selling VPN services</p>
        </div>
      ) : (
        <div className="space-y-4">
          {panels.map((panel, index) => (
            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/40 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{panel.name || `GhostSurf Panel ${index + 1}`}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{panel.panel_url || 'http://ghostsurf.io/api/v1/reseller/api'}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">Key: {panel.api_key ? `...${panel.api_key.slice(-8)}` : 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setSyncingPanel(index); updateMutation.mutate(panels); setTimeout(() => syncUsersMutation.mutate(index), 500); }}
                    disabled={syncUsersMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-lg hover:bg-blue-200"
                    data-testid={`sync-ghostsurf-${index}`}
                  >
                    {syncUsersMutation.isPending && syncingPanel === index ? 'Syncing...' : 'Sync Users'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTestingPanel(index); updateMutation.mutate(panels); setTimeout(() => testMutation.mutate(), 500); }}
                    disabled={testMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 rounded-lg hover:bg-teal-200"
                    data-testid={`test-ghostsurf-${index}`}
                  >
                    {testMutation.isPending && testingPanel === index ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingPanel(index); setShowModal(true); }}
                    className="p-1.5 text-gray-400 hover:text-blue-600"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemovePanel(index)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { setEditingPanel(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-teal-500 hover:text-teal-600"
          data-testid="add-ghostsurf-panel-btn"
        >
          <Plus className="w-5 h-5" /> Add GhostSurf Panel
        </button>
        {panels.length > 0 && (
          <button
            type="button"
            onClick={() => updateMutation.mutate(panels)}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            data-testid="save-ghostsurf-panels-btn"
          >
            <Save className="w-5 h-5" /> {updateMutation.isPending ? 'Saving...' : 'Save Panels'}
          </button>
        )}
      </div>

      {showModal && (
        <PanelFormModal
          panel={editingPanel !== null ? panels[editingPanel] : null}
          onClose={() => { setShowModal(false); setEditingPanel(null); }}
          onSave={handleAddPanel}
        />
      )}
    </div>
  );
}

function PanelFormModal({ panel, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: panel?.name || '',
    panel_url: panel?.panel_url || 'https://ghostsurf.io/api/v1/reseller/api',
    api_key: panel?.api_key || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.api_key) { toast.error('API key is required'); return; }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {panel ? 'Edit GhostSurf Panel' : 'Add GhostSurf Panel'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Panel Name</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="My GhostSurf VPN" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" data-testid="ghostsurf-panel-name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Base URL</label>
            <input type="text" value={formData.panel_url} onChange={(e) => setFormData({...formData, panel_url: e.target.value})} placeholder="http://ghostsurf.io/api/v1/reseller/api" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" data-testid="ghostsurf-panel-url" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reseller API Key *</label>
            <input type="password" value={formData.api_key} onChange={(e) => setFormData({...formData, api_key: e.target.value})} placeholder="gsr_..." required className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono" data-testid="ghostsurf-api-key" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your X-Reseller-Key from the GhostSurf dashboard</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700" data-testid="save-ghostsurf-panel">
              <Check className="w-4 h-4" /> {panel ? 'Update Panel' : 'Add Panel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
