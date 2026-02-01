import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Lock, Save } from 'lucide-react';
import api from '../api/api';

export default function AdminPasswordChange() {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const changeMutation = useMutation({
    mutationFn: (data) => api.post('/api/admin/change-password', {
      current_password: data.current_password,
      new_password: data.new_password
    }),
    onSuccess: () => {
      alert('Password changed successfully! Please login again.');
      // Logout and redirect to login
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
    },
    onError: (error) => {
      alert('Failed to change password: ' + (error.response?.data?.detail || error.message));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    if (formData.new_password.length < 8) {
      alert('New password must be at least 8 characters');
      return;
    }
    
    if (formData.new_password !== formData.confirm_password) {
      alert('New passwords do not match');
      return;
    }
    
    if (formData.current_password === formData.new_password) {
      alert('New password must be different from current password');
      return;
    }
    
    changeMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Change Admin Password</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Update your admin account password for enhanced security
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-6 h-6 text-blue-600" />
          <h4 className="font-semibold text-gray-900 dark:text-white">Security Settings</h4>
        </div>

        {/* Current Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Password *
          </label>
          <input
            type="password"
            required
            value={formData.current_password}
            onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Enter your current password"
          />
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            New Password *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={formData.new_password}
            onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Enter new password (min 8 characters)"
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Confirm New Password *
          </label>
          <input
            type="password"
            required
            value={formData.confirm_password}
            onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Confirm new password"
          />
        </div>

        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Security Tips:</strong>
          </p>
          <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
            <li>Use at least 8 characters</li>
            <li>Include uppercase, lowercase, numbers, and symbols</li>
            <li>Don't reuse passwords from other accounts</li>
            <li>You will be logged out after changing password</li>
          </ul>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={changeMutation.isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {changeMutation.isLoading ? 'Changing Password...' : 'Change Password'}
          </button>
        </div>
      </form>

      {/* Warning */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-sm text-red-800 dark:text-red-300">
          <strong>⚠️ Important:</strong> After changing your password, you will be automatically logged out and redirected to the login page. 
          Please use your new password to log back in.
        </p>
      </div>
    </div>
  );
}
