import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft, Plus, Trash2, Edit, X, Check, Shield, Users, MessageSquare, ShoppingBag, Server, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const PERMISSION_OPTIONS = [
  { key: 'dashboard', label: 'Dashboard Stats', icon: LayoutDashboard, desc: 'View admin dashboard statistics' },
  { key: 'tickets', label: 'Support Tickets', icon: MessageSquare, desc: 'View and reply to tickets' },
  { key: 'customers', label: 'Customers', icon: Users, desc: 'View and edit customer accounts' },
  { key: 'imported_users', label: 'Imported Users', icon: Server, desc: 'View and manage imported panel users' },
  { key: 'orders', label: 'Orders', icon: ShoppingBag, desc: 'View orders and invoices' },
  { key: 'services', label: 'Services', icon: Shield, desc: 'View and manage customer services' },
];

export default function StaffManagement() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const { data: staffList } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => { const r = await adminAPI.getStaff(); return r.data; },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminAPI.deleteStaff(id),
    onSuccess: () => { queryClient.invalidateQueries(['staff']); toast.success('Staff account deleted'); },
    onError: (e) => toast.error(e.response?.data?.detail || 'Delete failed'),
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/admin" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 mb-6">
          <ArrowLeft className="w-5 h-5" /> Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Management</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Create staff accounts with limited admin permissions</p>
          </div>
          <button onClick={() => { setEditingStaff(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 font-semibold">
            <Plus className="w-5 h-5" /> Add Staff
          </button>
        </div>

        {/* Staff List */}
        <div className="space-y-3">
          {staffList?.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No staff accounts yet</p>
            </div>
          )}
          {staffList?.map((staff) => (
            <div key={staff.id} className="bg-white dark:bg-gray-900 rounded-lg shadow p-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{staff.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{staff.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(staff.permissions || []).map((p) => {
                    const perm = PERMISSION_OPTIONS.find(o => o.key === p);
                    return (
                      <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                        {perm?.label || p}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setEditingStaff(staff); setShowModal(true); }}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => { if (window.confirm(`Delete staff "${staff.name}"?`)) deleteMutation.mutate(staff.id); }}
                  className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg hover:bg-red-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <StaffModal
          staff={editingStaff}
          onClose={() => { setShowModal(false); setEditingStaff(null); }}
          onSaved={() => { setShowModal(false); setEditingStaff(null); queryClient.invalidateQueries(['staff']); }}
        />
      )}
    </div>
  );
}

function StaffModal({ staff, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: staff?.name || '',
    email: staff?.email || '',
    password: '',
    permissions: staff?.permissions || ['dashboard', 'tickets'],
  });
  const [saving, setSaving] = useState(false);

  const togglePerm = (key) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || (!staff && !form.password)) {
      toast.error('Name, email, and password are required');
      return;
    }
    setSaving(true);
    try {
      if (staff) {
        const payload = { name: form.name, permissions: form.permissions };
        if (form.password) payload.password = form.password;
        await adminAPI.updateStaff(staff.id, payload);
        toast.success('Staff account updated');
      } else {
        await adminAPI.createStaff(form);
        toast.success('Staff account created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 m-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{staff ? 'Edit Staff' : 'Add Staff Member'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required disabled={!!staff}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{staff ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} required={!staff}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
            <div className="space-y-2">
              {PERMISSION_OPTIONS.map((perm) => {
                const Icon = perm.icon;
                return (
                  <label key={perm.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={form.permissions.includes(perm.key)} onChange={() => togglePerm(perm.key)}
                      className="w-4 h-4 text-blue-600 rounded" />
                    <Icon className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{perm.label}</p>
                      <p className="text-xs text-gray-500">{perm.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50">
              {saving ? 'Saving...' : staff ? 'Update' : 'Create Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
