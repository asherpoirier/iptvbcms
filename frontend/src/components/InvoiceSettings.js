import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Save, FileText, Upload, X } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function InvoiceSettings({ settings }) {
  const queryClient = useQueryClient();
  const inv = settings?.invoice || {};

  const [formData, setFormData] = useState({
    company_name: inv.company_name || '',
    company_address: inv.company_address || '',
    company_phone: inv.company_phone || '',
    company_email: inv.company_email || '',
    company_website: inv.company_website || '',
    logo_url: inv.logo_url || '',
    invoice_prefix: inv.invoice_prefix || 'INV',
    next_number: inv.next_number || 1001,
    number_padding: inv.number_padding || 4,
    notes: inv.notes || '',
    terms: inv.terms || '',
    payment_instructions: inv.payment_instructions || '',
    primary_color: inv.primary_color || '#2563eb',
    accent_color: inv.accent_color || '#f3f4f6',
  });

  React.useEffect(() => {
    if (settings?.invoice) {
      const i = settings.invoice;
      setFormData({
        company_name: i.company_name || '',
        company_address: i.company_address || '',
        company_phone: i.company_phone || '',
        company_email: i.company_email || '',
        company_website: i.company_website || '',
        logo_url: i.logo_url || '',
        invoice_prefix: i.invoice_prefix || 'INV',
        next_number: i.next_number || 1001,
        number_padding: i.number_padding || 4,
        notes: i.notes || '',
        terms: i.terms || '',
        payment_instructions: i.payment_instructions || '',
        primary_color: i.primary_color || '#2563eb',
        accent_color: i.accent_color || '#f3f4f6',
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data) => {
      const settingsUpdate = { ...settings, invoice: data };
      return adminAPI.updateSettings(settingsUpdate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-settings']);
      alert('Invoice settings saved!');
    },
    onError: (error) => {
      alert('Failed to save: ' + (error.response?.data?.detail || error.message));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate({ ...formData, next_number: parseInt(formData.next_number), number_padding: parseInt(formData.number_padding) });
  };

  const [uploading, setUploading] = useState(false);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token;
      const res = await axios.post(`${API_URL}/api/admin/upload/logo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
      });
      setFormData({ ...formData, logo_url: res.data.url });
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.detail || err.message));
    }
    setUploading(false);
  };

  const previewNumber = `${formData.invoice_prefix}-${String(formData.next_number).padStart(formData.number_padding, '0')}`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice Settings</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Customize your invoice appearance, numbering, and content</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Company Information */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Company Information</h3>
          
          {/* Logo Upload */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Logo</label>
            <div className="flex items-center gap-4">
              {formData.logo_url ? (
                <div className="relative">
                  <img src={formData.logo_url} alt="Logo" className="w-20 h-20 object-contain rounded-lg border border-gray-200 dark:border-gray-600 bg-white p-1" />
                  <button type="button"
                    onClick={() => setFormData({ ...formData, logo_url: '' })}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400">
                  <FileText className="w-8 h-8" />
                </div>
              )}
              <div>
                <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer text-sm font-medium ${
                  uploading ? 'bg-gray-200 dark:bg-gray-700 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}>
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Upload Logo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload}
                    disabled={uploading} className="hidden" />
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PNG, JPG or WebP. Max 2MB.</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
              <input type="text" value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Your Company Name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" value={formData.company_email}
                onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                placeholder="billing@company.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
              <input type="text" value={formData.company_address}
                onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                placeholder="123 Business St, City, Province, Postal Code"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input type="text" value={formData.company_phone}
                onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Website</label>
              <input type="text" value={formData.company_website}
                onChange={(e) => setFormData({ ...formData, company_website: e.target.value })}
                placeholder="https://yourcompany.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>
        </section>

        {/* Invoice Numbering */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice Numbering</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prefix</label>
              <input type="text" value={formData.invoice_prefix}
                onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value })}
                placeholder="INV"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Next Number</label>
              <input type="number" min="1" value={formData.next_number}
                onChange={(e) => setFormData({ ...formData, next_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zero Padding</label>
              <select value={formData.number_padding}
                onChange={(e) => setFormData({ ...formData, number_padding: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value={3}>3 digits (001)</option>
                <option value={4}>4 digits (0001)</option>
                <option value={5}>5 digits (00001)</option>
                <option value={6}>6 digits (000001)</option>
              </select>
            </div>
          </div>
          <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Preview: <span className="font-mono font-bold">{previewNumber}</span>
            </p>
          </div>
        </section>

        {/* Template Colors */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Template Colors</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
                <input type="text" value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Used for header, table headers, accents</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Accent Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={formData.accent_color}
                  onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
                <input type="text" value={formData.accent_color}
                  onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Used for total row background, detail labels</p>
            </div>
          </div>
        </section>

        {/* Custom Content */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Custom Content</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Instructions</label>
              <textarea rows={3} value={formData.payment_instructions}
                onChange={(e) => setFormData({ ...formData, payment_instructions: e.target.value })}
                placeholder="Shown on unpaid invoices. E.g., bank transfer details, EMT email, payment deadlines..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea rows={2} value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="E.g., Thank you for your purchase! Contact support@company.com for any questions."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Terms & Conditions</label>
              <textarea rows={3} value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                placeholder="E.g., All sales are final. Refunds within 14 days of purchase only. Services subject to our ToS."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>
        </section>

        <button type="submit" disabled={updateMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50">
          <Save className="w-5 h-5" />
          {updateMutation.isPending ? 'Saving...' : 'Save Invoice Settings'}
        </button>
      </form>
    </div>
  );
}
