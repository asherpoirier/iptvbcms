import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Save, Plus, Trash2, Server, X, Check, Package, Users, Layers, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

export default function NxtDashPanelManagement({ settings }) {
  const queryClient = useQueryClient();
  const [panels, setPanels] = useState(settings?.nxtdash?.panels || []);
  const [showModal, setShowModal] = useState(false);
  const [editingPanel, setEditingPanel] = useState(null);
  const [testingPanelId, setTestingPanelId] = useState(null);
  const [fetchingPkgs, setFetchingPkgs] = useState(null);
  const [syncingBouquets, setSyncingBouquets] = useState(null);
  const [syncingUsers, setSyncingUsers] = useState(null);
  const [editingBouquets, setEditingBouquets] = useState(null); // panel index
  const [bouquetEdits, setBouquetEdits] = useState([]); // editable bouquet list

  React.useEffect(() => {
    const serverPanels = settings?.nxtdash?.panels || [];
    if (serverPanels.length > 0) setPanels(serverPanels);
  }, [settings?.nxtdash?.panels]);

  const updateMutation = useMutation({
    mutationFn: (data) => {
      const settingsUpdate = { ...settings, nxtdash: { panels: data } };
      return adminAPI.updateSettings(settingsUpdate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-settings']);
      toast.success('NXT Dash panels saved!');
    },
    onError: (error) => toast.error('Failed to save: ' + (error.response?.data?.detail || error.message)),
  });

  const testMutation = useMutation({
    mutationFn: () => adminAPI.testNxtDash(),
    onSuccess: (response) => {
      toast.success(response.data?.message || 'Connection successful!');
      setTestingPanelId(null);
    },
    onError: (error) => {
      toast.error('Connection failed: ' + (error.response?.data?.detail || 'Unknown error'));
      setTestingPanelId(null);
    },
  });

  const packagesMutation = useMutation({
    mutationFn: (panelIndex) => adminAPI.getNxtDashPackages(panelIndex),
    onSuccess: (response) => {
      const data = response.data;
      toast.info(`Packages: ${data.count} regular, ${data.trial_count} trial`);
      setFetchingPkgs(null);
    },
    onError: (error) => {
      toast.error('Failed: ' + (error.response?.data?.detail || error.message));
      setFetchingPkgs(null);
    },
  });

  const handleSyncBouquets = async (index) => {
    setSyncingBouquets(index);
    try {
      const settingsUpdate = { ...settings, nxtdash: { panels } };
      await adminAPI.updateSettings(settingsUpdate);
      const resp = await adminAPI.getNxtDashBouquets(index);
      const bouquets = resp.data.bouquets || [];
      setBouquetEdits(bouquets);
      setEditingBouquets(index);
      queryClient.invalidateQueries(['admin-settings']);
      toast.success(`${bouquets.length} bouquets synced! You can now rename them below.`);
    } catch (err) {
      toast.error('Failed: ' + (err.response?.data?.detail || err.message));
    }
    setSyncingBouquets(null);
  };

  const handleSaveBouquetNames = async (index) => {
    try {
      await adminAPI.updateNxtDashBouquetNames(bouquetEdits, index);
      queryClient.invalidateQueries(['admin-settings']);
      setEditingBouquets(null);
      toast.success('Bouquet names saved!');
    } catch (err) {
      toast.error('Failed to save: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleOpenBouquetEditor = (index) => {
    const panel = panels[index];
    setBouquetEdits(panel?.bouquets || []);
    setEditingBouquets(editingBouquets === index ? null : index);
  };

  const handleSyncUsers = async (index) => {
    setSyncingUsers(index);
    try {
      const settingsUpdate = { ...settings, nxtdash: { panels } };
      await adminAPI.updateSettings(settingsUpdate);
      queryClient.invalidateQueries(['admin-settings']);
      const resp = await adminAPI.syncNxtDashUsers(index);
      toast.success(`Users synced: ${resp.data.synced} new, ${resp.data.updated} updated`);
      queryClient.invalidateQueries(['imported-users']);
    } catch (err) {
      toast.error('Failed: ' + (err.response?.data?.detail || err.message));
    }
    setSyncingUsers(null);
  };

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
    if (window.confirm('Remove this NXT Dash panel?')) {
      setPanels(panels.filter((_, i) => i !== index));
    }
  };

  const handleTest = (index) => {
    setTestingPanelId(index);
    // Save first, then test
    const settingsUpdate = { ...settings, nxtdash: { panels } };
    adminAPI.updateSettings(settingsUpdate).then(() => {
      queryClient.invalidateQueries(['admin-settings']);
      testMutation.mutate();
    }).catch(() => testMutation.mutate());
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <Server className="w-5 h-5 text-cyan-600" />
          NXT Dash Panel Integration
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Connect your NXT Dash reseller panels. Requires: DNS (panel URL), API Token, Username, and Password from your provider.
        </p>
      </div>

      {/* Existing Panels */}
      {panels.map((panel, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-cyan-600" />
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">{panel.name || `NXT Dash Panel ${index + 1}`}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">{panel.panel_url}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => handleTest(index)} disabled={testingPanelId === index}
                className="px-3 py-1.5 bg-cyan-600 text-white text-sm rounded hover:bg-cyan-700 disabled:opacity-50">
                {testingPanelId === index ? 'Testing...' : 'Test'}
              </button>
              <button onClick={() => { setFetchingPkgs(index); packagesMutation.mutate(index); }} disabled={fetchingPkgs === index}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                <Package className="w-4 h-4 inline mr-1" />{fetchingPkgs === index ? '...' : 'Packages'}
              </button>
              <button onClick={() => handleSyncBouquets(index)} disabled={syncingBouquets === index}
                className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
                <Layers className="w-4 h-4 inline mr-1" />{syncingBouquets === index ? '...' : 'Bouquets'}
              </button>
              <button onClick={() => handleSyncUsers(index)} disabled={syncingUsers === index}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">
                <Users className="w-4 h-4 inline mr-1" />{syncingUsers === index ? 'Syncing...' : 'Sync Users'}
              </button>
              <button onClick={() => { setEditingPanel(index); setShowModal(true); }}
                className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700">Edit</button>
              <button onClick={() => handleRemovePanel(index)}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div>Username: <span className="font-medium text-gray-900 dark:text-white">{panel.username}</span></div>
            <div>Portal: <span className="font-medium text-gray-900 dark:text-white">{panel.streaming_url || panel.portal_url || 'Not set'}</span></div>
          </div>
          {panel.bouquets?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => handleOpenBouquetEditor(index)}
                className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5" /> {editingBouquets === index ? 'Hide' : 'Rename'} Bouquets ({panel.bouquets.length})
              </button>
            </div>
          )}
          {editingBouquets === index && bouquetEdits.length > 0 && (
            <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Rename Bouquets (NXT Dash API doesn't provide names)</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {bouquetEdits.map((b, bi) => (
                  <div key={b.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-10 text-right">#{b.id}</span>
                    <input type="text" value={b.name} onChange={(e) => {
                      const updated = [...bouquetEdits];
                      updated[bi] = { ...b, name: e.target.value };
                      setBouquetEdits(updated);
                    }} className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                ))}
              </div>
              <button onClick={() => handleSaveBouquetNames(index)}
                className="mt-3 px-4 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 font-medium">
                Save Bouquet Names
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Add / Save buttons */}
      <div className="flex gap-3">
        <button onClick={() => { setEditingPanel(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-cyan-600 text-white px-4 py-2.5 rounded-lg hover:bg-cyan-700 font-semibold">
          <Plus className="w-5 h-5" /> Add NXT Dash Panel
        </button>
        {panels.length > 0 && (
          <button onClick={handleSave} disabled={updateMutation.isPending}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50">
            <Save className="w-5 h-5" /> {updateMutation.isPending ? 'Saving...' : 'Save Panels'}
          </button>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <PanelModal
          panel={editingPanel !== null ? panels[editingPanel] : null}
          onSave={handleAddPanel}
          onClose={() => { setShowModal(false); setEditingPanel(null); }}
        />
      )}
    </div>
  );
}

function PanelModal({ panel, onSave, onClose }) {
  const [form, setForm] = useState({
    name: panel?.name || '',
    panel_url: panel?.panel_url || '',
    token: panel?.token || '',
    username: panel?.username || '',
    password: panel?.password || '',
    streaming_url: panel?.streaming_url || '',
    portal_url: panel?.portal_url || '',
    active: panel?.active !== false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.panel_url || !form.token || !form.username || !form.password) {
      toast.error('Panel URL (DNS), Token, Username, and Password are required');
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 m-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {panel ? 'Edit NXT Dash Panel' : 'Add NXT Dash Panel'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Panel Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My NXT Dash Panel"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">DNS / Panel URL *</label>
            <input type="text" value={form.panel_url} onChange={(e) => setForm({ ...form, panel_url: e.target.value })} placeholder="bestpanel.xyz" required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <p className="text-xs text-gray-500 mt-1">The server URL provided by your NXT Dash admin</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Token *</label>
            <input type="password" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder="Bearer token from your provider" required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username *</label>
              <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Reseller username" required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password *</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Reseller password" required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Streaming DNS / Server URL</label>
            <input type="text" value={form.streaming_url} onChange={(e) => setForm({ ...form, streaming_url: e.target.value })} placeholder="http://stream.example.com:8080"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <p className="text-xs text-gray-500 mt-1">The URL customers use to connect their IPTV player (shown on service cards and emails)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Portal URL (for customers)</label>
            <input type="text" value={form.portal_url} onChange={(e) => setForm({ ...form, portal_url: e.target.value })} placeholder="http://portal.example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" className="flex items-center gap-2 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 font-semibold">
              <Check className="w-4 h-4" /> {panel ? 'Update Panel' : 'Add Panel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
