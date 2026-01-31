import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft, Plus, Download, Trash2, Monitor, Smartphone, Book, FileText } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function AdminDownloads() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'iptv_player',
    version: '',
    platform: 'all',
    requires_active_service: true,
    linked_service_types: [],
    file_path: '',
    file_url: '',
    file_size: 0,
    file_type: ''
  });

  const { data: downloads, isLoading } = useQuery({
    queryKey: ['admin-downloads'],
    queryFn: async () => {
      const response = await adminAPI.getDownloads();
      return response.data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ['products-for-linking'],
    queryFn: async () => {
      const response = await adminAPI.getProducts();
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => adminAPI.createDownload(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-downloads']);
      setShowModal(false);
      resetForm();
      alert('Download created successfully!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminAPI.deleteDownload(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-downloads']);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'iptv_player',
      version: '',
      platform: 'all',
      requires_active_service: true,
      linked_service_types: [],
      file_path: '',
      file_url: '',
      file_size: 0,
      file_type: ''
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const token = localStorage.getItem('auth-storage');
      const authData = token ? JSON.parse(token) : null;
      const bearerToken = authData?.state?.token;

      const response = await axios.post(
        `${API_URL}/api/admin/upload/download`,
        formDataUpload,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${bearerToken}`
          }
        }
      );

      setFormData({
        ...formData,
        file_path: response.data.path,
        file_url: response.data.url,
        file_size: response.data.size,
        file_type: file.type,
        name: formData.name || file.name
      });

      alert('File uploaded successfully!');
    } catch (error) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <header className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/admin" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600">
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Downloads Management</h1>
            <p className="text-gray-600 dark:text-gray-400">Upload and manage client downloads</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            data-testid="create-download-btn"
          >
            <Plus className="w-5 h-5" />
            Add Download
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : downloads && downloads.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {downloads.map((dl) => (
              <div key={dl.id} className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{dl.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{dl.description}</p>
                <div className="text-sm space-y-1 mb-4">
                  <p><span className="text-gray-500">Platform:</span> <span className="capitalize">{dl.platform}</span></p>
                  <p><span className="text-gray-500">Size:</span> {formatFileSize(dl.file_size)}</p>
                  <p><span className="text-gray-500">Downloads:</span> {dl.download_count || 0}</p>
                  {dl.linked_service_types && dl.linked_service_types.length > 0 && (
                    <div>
                      <p className="text-gray-500 mb-1">Linked Products:</p>
                      {dl.linked_service_types.map(productId => {
                        const product = products?.find(p => p.id === productId);
                        return product ? (
                          <span key={productId} className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs mr-1 mb-1">
                            {product.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete ${dl.name}?`)) {
                      deleteMutation.mutate(dl.id);
                    }
                  }}
                  className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center">
            <Download className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No downloads yet. Click Add Download to create one.</p>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full">
              <div className="p-6 border-b flex justify-between">
                <h3 className="text-xl font-bold">Add Download</h3>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500">×</button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Upload File *</label>
                  <input type="file" onChange={handleFileUpload} disabled={uploading} className="w-full px-4 py-2 border rounded-lg" />
                  {uploading && <p className="text-sm text-blue-600 mt-2">Uploading...</p>}
                  {formData.file_url && <p className="text-sm text-green-600 mt-2">✓ File uploaded</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="IPTV Smarters Pro"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Category</label>
                    <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                      <option value="iptv_player">IPTV Player</option>
                      <option value="mobile_app">Mobile App</option>
                      <option value="guide">Guide</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Platform</label>
                    <select value={formData.platform} onChange={(e) => setFormData({...formData, platform: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                      <option value="all">All</option>
                      <option value="android">Android</option>
                      <option value="ios">iOS</option>
                      <option value="windows">Windows</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Version</label>
                    <input
                      type="text"
                      value={formData.version}
                      onChange={(e) => setFormData({...formData, version: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      placeholder="1.0"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <label className="flex items-center gap-2 mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requires_active_service}
                      onChange={(e) => setFormData({...formData, requires_active_service: e.target.checked})}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium">Require active service to download</span>
                  </label>

                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-sm font-medium mb-2">Link to Specific Products (Optional)</p>
                    <p className="text-xs text-gray-500 mb-3">Select which products can access this download. Leave all unchecked for all products.</p>
                    
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {products && products.length > 0 ? (
                        products.map((product) => (
                          <label key={product.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.linked_service_types.includes(product.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({...formData, linked_service_types: [...formData.linked_service_types, product.id]});
                                } else {
                                  setFormData({...formData, linked_service_types: formData.linked_service_types.filter(id => id !== product.id)});
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-sm">{product.name}</span>
                          </label>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No products available. Create products first.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                  <button onClick={(e) => { e.preventDefault(); if (formData.file_url) createMutation.mutate(formData); }} disabled={!formData.file_url} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">Create</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
