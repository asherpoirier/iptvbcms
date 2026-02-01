import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Save, Trash2, Download, Upload, Cloud, CloudOff, CheckCircle, 
  AlertTriangle, FolderUp, Database, Settings as SettingsIcon 
} from 'lucide-react';
import api from '../api/api';

export default function BackupManager() {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [showCloudSettings, setShowCloudSettings] = useState(false);
  const [cloudProvider, setCloudProvider] = useState('');
  const [dropboxToken, setDropboxToken] = useState('');
  const [googleServiceAccount, setGoogleServiceAccount] = useState('');
  const [protonWebdavUrl, setProtonWebdavUrl] = useState('');
  const [protonUsername, setProtonUsername] = useState('');
  const [protonPassword, setProtonPassword] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);

  // Get backups list
  const { data: backupsData, isLoading: loadingBackups, refetch: refetchBackups } = useQuery({
    queryKey: ['all-backups'],
    queryFn: async () => {
      const response = await api.get('/api/admin/backups/list');
      return response.data;
    },
  });

  // Get backup settings
  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ['backup-settings'],
    queryFn: async () => {
      const response = await api.get('/api/admin/backups/settings');
      return response.data;
    },
  });

  // Create manual backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/admin/backups/create', {
        description: description
      });
      return response.data;
    },
    onSuccess: (data) => {
      setDescription('');
      refetchBackups();
      alert(`Backup created successfully!\n\nName: ${data.backup_name}\n\nPath: ${data.backup_path}`);
    },
    onError: (error) => {
      alert('Backup creation failed: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (backupName) => {
      const response = await api.delete(`/api/admin/backups/${backupName}`);
      return response.data;
    },
    onSuccess: () => {
      refetchBackups();
      alert('Backup deleted successfully');
    },
    onError: (error) => {
      alert('Delete failed: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (backupName) => {
      const response = await api.post(`/api/admin/backups/restore/${backupName}`);
      return response.data;
    },
    onSuccess: (data) => {
      alert(data.message || 'Backup restored successfully! Page will reload in 5 seconds.');
      setTimeout(() => window.location.reload(), 5000);
    },
    onError: (error) => {
      alert('Restore failed: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings) => {
      const response = await api.post('/api/admin/backups/settings', newSettings);
      return response.data;
    },
    onSuccess: () => {
      refetchSettings();
      alert('Settings saved successfully!');
      setShowCloudSettings(false);
    },
    onError: (error) => {
      alert('Failed to save settings: ' + (error.response?.data?.detail || error.message));
    },
  });

  const handleCreateBackup = () => {
    if (window.confirm('Create a manual backup now?\n\nThis will backup all application files (excluding venv and node_modules).')) {
      createBackupMutation.mutate();
    }
  };

  const handleDeleteBackup = (backupName) => {
    if (window.confirm(`Delete backup: ${backupName}?\n\nThis cannot be undone.`)) {
      deleteBackupMutation.mutate(backupName);
    }
  };

  const handleRestoreBackup = (backupName) => {
    if (window.confirm(`Restore from backup: ${backupName}?\n\nThe system will restart and this page will reload.`)) {
      restoreBackupMutation.mutate(backupName);
    }
  };

  const handleTestCloudConnection = async () => {
    if (!cloudProvider) {
      alert('Please select a cloud provider');
      return;
    }

    let credentials = {};

    if (cloudProvider === 'dropbox') {
      if (!dropboxToken) {
        alert('Please enter Dropbox access token');
        return;
      }
      credentials = { access_token: dropboxToken };
    } else if (cloudProvider === 'google_drive') {
      if (!googleServiceAccount) {
        alert('Please paste Google Service Account JSON');
        return;
      }
      try {
        const serviceAccountData = JSON.parse(googleServiceAccount);
        credentials = { 
          auth_type: 'service_account',
          service_account: serviceAccountData 
        };
      } catch (e) {
        alert('Invalid JSON format. Please paste the complete service account JSON.');
        return;
      }
    } else if (cloudProvider === 'proton_drive') {
      if (!protonWebdavUrl || !protonUsername || !protonPassword) {
        alert('Please fill in all Proton Drive fields');
        return;
      }
      credentials = {
        webdav_url: protonWebdavUrl,
        username: protonUsername,
        password: protonPassword
      };
    }

    setTestingConnection(true);
    try {
      const response = await api.post('/api/admin/backups/test-cloud', {
        provider: cloudProvider,
        credentials: credentials
      });

      if (response.data.success) {
        alert(`✓ Connection successful!\n\nAccount: ${response.data.account}\nEmail: ${response.data.email}`);
      }
    } catch (error) {
      alert('Connection test failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveCloudSettings = () => {
    const newSettings = {
      cloud_backup_enabled: true,
      cloud_provider: cloudProvider
    };

    if (cloudProvider === 'dropbox') {
      newSettings.dropbox_access_token = dropboxToken;
    } else if (cloudProvider === 'google_drive') {
      try {
        const serviceAccountData = JSON.parse(googleServiceAccount);
        newSettings.google_drive_service_account = serviceAccountData;
        newSettings.google_drive_auth_type = 'service_account';
      } catch (e) {
        alert('Invalid service account JSON');
        return;
      }
    } else if (cloudProvider === 'proton_drive') {
      newSettings.proton_drive = {
        webdav_url: protonWebdavUrl,
        username: protonUsername,
        password: protonPassword
      };
    }

    updateSettingsMutation.mutate(newSettings);
  };

  const handleDisableCloudBackup = () => {
    if (window.confirm('Disable cloud backups?\n\nFuture backups will only be stored locally.')) {
      updateSettingsMutation.mutate({
        cloud_backup_enabled: false
      });
    }
  };

  const handleDownloadBackup = (backupName) => {
    // Trigger download via API
    const token = localStorage.getItem('token');
    const downloadUrl = `${process.env.REACT_APP_BACKEND_URL}/api/admin/backups/${backupName}/download`;
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `${backupName}.zip`);
    
    // Add authorization header via fetch and blob
    fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        link.href = url;
        link.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(error => {
        alert('Download failed: ' + error.message);
      });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Backup Management
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Create manual backups and configure cloud storage
        </p>
      </div>

      {/* Cloud Backup Status */}
      {settings?.cloud_backup_enabled && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Cloud Backup Enabled
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Provider: {
                    settings.cloud_provider === 'dropbox' ? 'Dropbox' : 
                    settings.cloud_provider === 'google_drive' ? 'Google Drive' : 
                    settings.cloud_provider === 'proton_drive' ? 'Proton Drive' : 
                    'Unknown'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={handleDisableCloudBackup}
              className="text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            >
              Disable
            </button>
          </div>
        </div>
      )}

      {/* Create Manual Backup */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Create Manual Backup</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Backup all application files and configuration
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Backup description (optional)"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          
          <button
            onClick={handleCreateBackup}
            disabled={createBackupMutation.isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            <Save className="w-5 h-5" />
            {createBackupMutation.isLoading ? 'Creating Backup...' : 'Create Backup Now'}
          </button>
        </div>
      </div>

      {/* Cloud Storage Configuration */}
      {!settings?.cloud_backup_enabled && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Cloud className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Cloud Storage</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically backup to Dropbox or Google Drive
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCloudSettings(!showCloudSettings)}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {showCloudSettings ? 'Hide' : 'Configure'}
            </button>
          </div>

          {showCloudSettings && (
            <div className="space-y-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cloud Provider
                </label>
                <select
                  value={cloudProvider}
                  onChange={(e) => setCloudProvider(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select a provider</option>
                  <option value="dropbox">Dropbox</option>
                  <option value="google_drive">Google Drive (Service Account)</option>
                  <option value="proton_drive">Proton Drive (WebDAV)</option>
                </select>
              </div>

              {/* Dropbox Configuration */}
              {cloudProvider === 'dropbox' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dropbox Access Token
                  </label>
                  <input
                    type="password"
                    value={dropboxToken}
                    onChange={(e) => setDropboxToken(e.target.value)}
                    placeholder="Enter your Dropbox access token"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Get your access token from{' '}
                    <a
                      href="https://www.dropbox.com/developers/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Dropbox App Console
                    </a>
                  </p>
                </div>
              )}

              {/* Google Drive Configuration */}
              {cloudProvider === 'google_drive' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Service Account JSON
                  </label>
                  <textarea
                    value={googleServiceAccount}
                    onChange={(e) => setGoogleServiceAccount(e.target.value)}
                    placeholder='Paste your service account JSON here (entire content)'
                    rows="6"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs"
                  />
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-blue-900 dark:text-blue-200">
                      <strong>How to get Service Account JSON:</strong>
                    </p>
                    <ol className="text-xs text-blue-800 dark:text-blue-300 mt-2 list-decimal list-inside space-y-1">
                      <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                      <li>Create/select project → Enable Google Drive API</li>
                      <li>IAM & Admin → Service Accounts → Create Service Account</li>
                      <li>Create Key → JSON → Download the file</li>
                      <li>Paste the entire JSON content above</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Proton Drive Configuration */}
              {cloudProvider === 'proton_drive' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      WebDAV URL
                    </label>
                    <input
                      type="text"
                      value={protonWebdavUrl}
                      onChange={(e) => setProtonWebdavUrl(e.target.value)}
                      placeholder="https://webdav.proton.me"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Proton Email
                    </label>
                    <input
                      type="email"
                      value={protonUsername}
                      onChange={(e) => setProtonUsername(e.target.value)}
                      placeholder="your-email@proton.me"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      App Password
                    </label>
                    <input
                      type="password"
                      value={protonPassword}
                      onChange={(e) => setProtonPassword(e.target.value)}
                      placeholder="Proton app-specific password"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-xs text-purple-900 dark:text-purple-200">
                      <strong>Proton Drive WebDAV Setup:</strong>
                    </p>
                    <ol className="text-xs text-purple-800 dark:text-purple-300 mt-2 list-decimal list-inside space-y-1">
                      <li>Login to Proton Drive web interface</li>
                      <li>Go to Settings → Security</li>
                      <li>Generate an app-specific password for WebDAV</li>
                      <li>Use WebDAV URL: https://webdav.proton.me</li>
                      <li>Username: Your Proton email</li>
                      <li>Password: The app-specific password generated</li>
                    </ol>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleTestCloudConnection}
                  disabled={testingConnection || !cloudProvider}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
                
                <button
                  onClick={handleSaveCloudSettings}
                  disabled={
                    !cloudProvider || 
                    (cloudProvider === 'dropbox' && !dropboxToken) ||
                    (cloudProvider === 'google_drive' && !googleServiceAccount) ||
                    (cloudProvider === 'proton_drive' && (!protonWebdavUrl || !protonUsername || !protonPassword))
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Enable Cloud Backup
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Backups List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-white">Available Backups</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {backupsData?.backups?.length || 0} backups available
          </p>
        </div>

        <div className="p-6">
          {loadingBackups ? (
            <p className="text-center text-gray-600 dark:text-gray-400">Loading backups...</p>
          ) : backupsData?.backups && backupsData.backups.length > 0 ? (
            <div className="space-y-3">
              {backupsData.backups.map((backup) => (
                <div
                  key={backup.name}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {backup.name}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          backup.type === 'manual'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {backup.type}
                      </span>
                    </div>
                    {backup.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {backup.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(backup.created).toLocaleString()} • {backup.size_mb} MB
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadBackup(backup.name)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                      title="Download backup"
                      data-testid={`download-backup-${backup.name}`}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRestoreBackup(backup.name)}
                      className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                      title="Restore backup"
                      data-testid={`restore-backup-${backup.name}`}
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBackup(backup.name)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      title="Delete backup"
                      data-testid={`delete-backup-${backup.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600 dark:text-gray-400 py-8">
              No backups available. Create your first backup above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
