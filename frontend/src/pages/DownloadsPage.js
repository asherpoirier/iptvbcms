import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../api/api';
import { ArrowLeft, Download, Monitor, Smartphone, Book, FileText, AlertCircle } from 'lucide-react';

export default function DownloadsPage() {
  const { data: downloadsData, isLoading } = useQuery({
    queryKey: ['user-downloads'],
    queryFn: async () => {
      const response = await api.get('/api/downloads');
      return response.data;
    },
  });

  const trackDownloadMutation = useMutation({
    mutationFn: (downloadId) => api.post(`/api/downloads/${downloadId}/download`),
    onSuccess: (data) => {
      window.open(data.data.file_url, '_blank');
    },
  });

  const handleDownload = (download) => {
    trackDownloadMutation.mutate(download.id);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'iptv_player': return <Monitor className="w-8 h-8 text-blue-600" />;
      case 'mobile_app': return <Smartphone className="w-8 h-8 text-green-600" />;
      case 'guide': return <Book className="w-8 h-8 text-purple-600" />;
      default: return <FileText className="w-8 h-8 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <header className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600">
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Downloads</h1>
          <p className="text-gray-600 dark:text-gray-400">Download IPTV players, guides, and setup files</p>
        </div>

        {!downloadsData?.has_active_service && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900 dark:text-yellow-200">No Active Service</p>
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                You need an active service to access downloads. <Link to="/products" className="underline">Browse our plans</Link>
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : downloadsData?.downloads && downloadsData.downloads.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {downloadsData.downloads.map((download) => (
              <div key={download.id} className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    {getCategoryIcon(download.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">{download.name}</h3>
                    {download.version && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Version {download.version}</p>
                    )}
                  </div>
                </div>

                {download.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {download.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                  <span className="capitalize">{download.platform}</span>
                  <span>{formatFileSize(download.file_size)}</span>
                </div>

                <button
                  onClick={() => handleDownload(download)}
                  disabled={trackDownloadMutation.isLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  data-testid={`download-btn-${download.id}`}
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center">
            <Download className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Downloads Available</h3>
            <p className="text-gray-600 dark:text-gray-400">Check back later for client apps and guides</p>
          </div>
        )}
      </main>
    </div>
  );
}
