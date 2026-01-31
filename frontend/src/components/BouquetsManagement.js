import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Server, Save, Plus, Trash2 } from 'lucide-react';

export default function BouquetsManagement({ settings }) {
  const queryClient = useQueryClient();
  const panels = settings?.xtream?.panels || [];
  const [selectedPanelIndex, setSelectedPanelIndex] = useState(0);
  const [bouquetsList, setBouquetsList] = useState([]);
  const [newBouquet, setNewBouquet] = useState({ id: '', name: '' });

  const { data: bouquets } = useQuery({
    queryKey: ['bouquets', selectedPanelIndex],
    queryFn: async () => {
      const response = await adminAPI.getBouquets();
      return response.data;
    },
  });

  React.useEffect(() => {
    if (bouquets) {
      setBouquetsList(bouquets);
    }
  }, [bouquets]);

  const syncMutation = useMutation({
    mutationFn: () => {
      // Pass panel index to sync
      return fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/bouquets/sync?panel_index=${selectedPanelIndex}`, {
        headers: {
          Authorization: `Bearer ${JSON.parse(localStorage.getItem('auth-storage')).state.token}`,
        },
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      if (data.bouquets) {
        setBouquetsList(data.bouquets);
      }
      queryClient.invalidateQueries(['bouquets']);
      alert(`Success! Synced ${data.bouquets?.length || 0} bouquets from ${data.panel_name || 'panel'}!`);
    },
  });

  const updateBouquetsMutation = useMutation({
    mutationFn: (data) => adminAPI.updateBouquets(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bouquets']);
      alert('Bouquets saved!');
    },
  });

  const handleSync = () => {
    if (panels.length === 0) {
      alert('Please add a panel first in XtreamUI Panel tab');
      return;
    }
    syncMutation.mutate();
  };

  const handleAddBouquet = () => {
    if (newBouquet.id && newBouquet.name) {
      const updated = [...bouquetsList, { id: parseInt(newBouquet.id), name: newBouquet.name }];
      setBouquetsList(updated);
      setNewBouquet({ id: '', name: '' });
    }
  };

  const handleRemoveBouquet = (id) => {
    const updated = bouquetsList.filter(b => b.id !== id);
    setBouquetsList(updated);
  };

  const handleSave = () => {
    updateBouquetsMutation.mutate(bouquetsList);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Manage Bouquets</h3>
        
        {/* Panel Selector */}
        {panels.length > 0 ? (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select XtreamUI Panel
            </label>
            <select
              value={selectedPanelIndex}
              onChange={(e) => setSelectedPanelIndex(parseInt(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {panels.map((panel, index) => (
                <option key={index} value={index}>
                  {panel.name} - {panel.panel_url}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              Please add a panel first in the <strong>XtreamUI Panel</strong> tab.
            </p>
          </div>
        )}
        
        {/* Sync Button */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">
                Auto-Sync from {panels[selectedPanelIndex]?.name || 'Selected Panel'}
              </p>
              <p className="text-xs text-blue-700">
                Click to fetch bouquets from this panel's packages
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncMutation.isPending || panels.length === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Server className="w-5 h-5" />
              {syncMutation.isPending ? 'Syncing...' : 'Sync Bouquets'}
            </button>
          </div>
        </div>
      </div>

      {/* Bouquets List */}
      {bouquetsList.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Bouquets from {panels[selectedPanelIndex]?.name || 'Panel'} ({bouquetsList.length} total)
          </label>
          <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
            {bouquetsList.map((bouquet) => (
              <div key={bouquet.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <span className="font-semibold text-gray-900">{bouquet.name}</span>
                  <span className="text-sm text-gray-500 ml-3">ID: {bouquet.id}</span>
                </div>
                <button
                  onClick={() => handleRemoveBouquet(bouquet.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Bouquet Manually */}
      <div className="border-t pt-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Add Bouquet Manually
        </label>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="number"
            value={newBouquet.id}
            onChange={(e) => setNewBouquet({ ...newBouquet, id: e.target.value })}
            className="px-4 py-3 border border-gray-300 rounded-lg"
            placeholder="Bouquet ID"
          />
          <input
            type="text"
            value={newBouquet.name}
            onChange={(e) => setNewBouquet({ ...newBouquet, name: e.target.value })}
            className="px-4 py-3 border border-gray-300 rounded-lg"
            placeholder="Bouquet Name"
          />
        </div>
        <button
          onClick={handleAddBouquet}
          disabled={!newBouquet.id || !newBouquet.name}
          className="mt-3 flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          Add Bouquet
        </button>
      </div>

      <div className="pt-6 border-t">
        <button
          onClick={handleSave}
          disabled={updateBouquetsMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {updateBouquetsMutation.isPending ? 'Saving...' : 'Save Bouquets'}
        </button>
      </div>
    </div>
  );
}
