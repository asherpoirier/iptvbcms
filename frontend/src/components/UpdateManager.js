import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, RefreshCw, AlertTriangle, CheckCircle, History, Upload } from 'lucide-react';
import api from '../api/api';

export default function UpdateManager() {
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);

  // Check for updates
  const { data: updateInfo, isLoading: checkingUpdates, refetch } = useQuery({
    queryKey: ['update-check'],
    queryFn: async () => {
      const response = await api.get('/api/admin/updates/check');
      return response.data;
    },
    refetchInterval: 300000, // Check every 5 minutes
  });

  // Get backups list
  const { data: backupsData } = useQuery({
    queryKey: ['backups-list'],
    queryFn: async () => {
      const response = await api.get('/api/admin/updates/backups');
      return response.data;
    },
  });

  // Apply update mutation
  const applyUpdateMutation = useMutation({
    mutationFn: async () => {
      setUpdating(true);
      const response = await api.post('/api/admin/updates/apply');
      return response.data;
    },
    onSuccess: (data) => {
      alert(data.message || 'Update applied successfully! Page will reload in 5 seconds.');
      setTimeout(() => window.location.reload(), 5000);
    },
    onError: (error) => {
      setUpdating(false);
      alert('Update failed: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: async (backupName) => {
      const response = await api.post(`/api/admin/updates/rollback/${backupName}`);
      return response.data;
    },
    onSuccess: (data) => {
      alert(data.message || 'Rollback successful! Page will reload in 5 seconds.');
      setTimeout(() => window.location.reload(), 5000);
    },
    onError: (error) => {
      alert('Rollback failed: ' + (error.response?.data?.detail || error.message));
    },
  });

  const handleApplyUpdate = () => {
    if (window.confirm('Apply update now? A backup will be created automatically.\n\nThe system will restart and this page will reload.')) {
      applyUpdateMutation.mutate();
    }
  };

  const handleRollback = (backupName) => {
    if (window.confirm(`Rollback to backup: ${backupName}?\n\nThe system will restart and this page will reload.`)) {
      rollbackMutation.mutate(backupName);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">System Updates</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Manage updates from GitHub repository with automatic backup and rollback
        </p>
      </div>

      {/* Update Check Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Update Status</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Checking for latest updates...
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={checkingUpdates}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30"
          >
            <RefreshCw className={`w-4 h-4 ${checkingUpdates ? 'animate-spin' : ''}`} />
            Check Now
          </button>
        </div>

        {checkingUpdates ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Checking for updates...</p>
          </div>
        ) : updateInfo?.update_available ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Download className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h5 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">Update Available!</h5>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  New version: <code className="bg-yellow-100 dark:bg-yellow-900 px-2 py-0.5 rounded">{updateInfo.latest_commit?.substring(0, 8)}</code>
                  {updateInfo.current_commit && (
                    <span className="ml-2">
                      (current: <code className="bg-yellow-100 dark:bg-yellow-900 px-2 py-0.5 rounded">{updateInfo.current_commit.substring(0, 8)}</code>)
                    </span>
                  )}
                </p>
                <button
                  onClick={handleApplyUpdate}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {updating ? 'Updating...' : 'Apply Update Now'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <h5 className="font-semibold text-green-900 dark:text-green-200">System Up to Date</h5>
                <p className="text-sm text-green-800 dark:text-green-300">
                  Running latest version
                  {updateInfo?.current_commit && (
                    <code className="ml-2 bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded text-xs">
                      {updateInfo.current_commit.substring(0, 8)}
                    </code>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Backups List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          Backup History
        </h4>

        {backupsData?.backups && backupsData.backups.length > 0 ? (
          <div className="space-y-2">
            {backupsData.backups.slice(0, 5).map((backup) => (
              <div key={backup.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{backup.name}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date(backup.created).toLocaleString()} · {backup.size_mb?.toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => handleRollback(backup.name)}
                  disabled={rollbackMutation.isLoading}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">No backups available</p>
        )}
      </div>

      {/* Warning */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800 dark:text-red-300">
            <p className="font-semibold mb-1">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Updates are applied automatically from the GitHub repository</li>
              <li>A backup is created before each update</li>
              <li>System will restart during update (2-3 minutes downtime)</li>
              <li>If update fails, system automatically rolls back to backup</li>
              <li>Keep at least 3-5 backups for safety</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
