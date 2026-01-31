import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft, Plus, Key, Check, X, Calendar, Globe, Copy } from 'lucide-react';

export default function AdminLicenses() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    allowed_domains: '',
    max_domains: 1,
    expiry_days: null,
    notes: ''
  });

  const { data: licenses, isLoading } = useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      const response = await adminAPI.getLicenses();
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => adminAPI.createLicense(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['licenses']);
      setShowModal(false);
      resetForm();
      alert(`License created!\n\nKey: ${response.data.license_key}\n\nShare this key with the customer.`);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ key, reason }) => adminAPI.revokeLicense(key, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['licenses']);
      alert('License revoked');
    },
  });

  const activateMutation = useMutation({
    mutationFn: (key) => adminAPI.activateLicense(key),
    onSuccess: () => {
      queryClient.invalidateQueries(['licenses']);
      alert('License activated');
    },
  });

  const resetForm = () => {
    setFormData({
      customer_name: '',
      customer_email: '',
      allowed_domains: '',
      max_domains: 1,
      expiry_days: null,
      notes: ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const domains = formData.allowed_domains
      .split(',')
      .map(d => d.trim())
      .filter(d => d.length > 0);
    
    createMutation.mutate({
      ...formData,
      allowed_domains: domains,
      expiry_days: formData.expiry_days ? parseInt(formData.expiry_days) : null
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'expired': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'suspended': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'revoked': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">License Management</h1>
            <p className="text-gray-600 dark:text-gray-400">Create and manage application licenses</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            data-testid="create-license-btn"
          >
            <Plus className="w-5 h-5" />
            Generate License
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {licenses?.map((license) => (
              <div key={license.id} className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Key className="w-6 h-6 text-blue-600" />
                      <code className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                        {license.license_key}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(license.license_key);
                          alert('License key copied!');
                        }}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                      >
                        <Copy className="w-4 h-4 text-gray-600" />
                      </button>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(license.status)}`}>
                        {license.status}
                      </span>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      {license.customer_name && (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Customer</p>
                          <p className="font-medium text-gray-900 dark:text-white">{license.customer_name}</p>
                        </div>
                      )}
                      
                      {license.allowed_domains && license.allowed_domains.length > 0 && (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Domains ({license.allowed_domains.length}/{license.max_domains})</p>
                          <p className="font-medium text-gray-900 dark:text-white">{license.allowed_domains.join(', ')}</p>
                        </div>
                      )}
                      
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Issued</p>
                        <p className="font-medium text-gray-900 dark:text-white">{new Date(license.issued_date).toLocaleDateString()}</p>
                      </div>
                      
                      {license.expiry_date && (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Expires</p>
                          <p className="font-medium text-gray-900 dark:text-white">{new Date(license.expiry_date).toLocaleDateString()}</p>
                        </div>
                      )}
                      
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Validations</p>
                        <p className="font-medium text-gray-900 dark:text-white">{license.validation_count || 0}</p>
                      </div>
                    </div>

                    {license.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                        {license.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {license.status === 'active' ? (
                      <button
                        onClick={() => {
                          const reason = prompt('Reason for revoking:');
                          if (reason) {
                            revokeMutation.mutate({ key: license.license_key, reason });
                          }
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      >
                        Revoke
                      </button>
                    ) : (
                      <button
                        onClick={() => activateMutation.mutate(license.license_key)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full">
              <div className="p-6 border-b flex justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Generate New License</h3>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500">×</button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Customer Name</label>
                    <input
                      type="text"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Customer Email</label>
                    <input
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      placeholder="customer@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Allowed Domains (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.allowed_domains}
                    onChange={(e) => setFormData({...formData, allowed_domains: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="example.com, demo.example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to allow any domain</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Max Domains</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.max_domains}
                      onChange={(e) => setFormData({...formData, max_domains: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Expiry (days)</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.expiry_days || ''}
                      onChange={(e) => setFormData({...formData, expiry_days: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      placeholder="365 (or leave blank for lifetime)"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="Internal notes about this license"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="flex-1 px-4 py-2 border rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Generate License
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
