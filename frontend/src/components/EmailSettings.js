import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Save, Mail, Send, CheckCircle, AlertCircle } from 'lucide-react';

export default function EmailSettings({ settings }) {
  const queryClient = useQueryClient();
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState(null);
  
  const [formData, setFormData] = useState({
    smtp_host: settings?.smtp?.host || '',
    smtp_port: settings?.smtp?.port || 587,
    smtp_username: settings?.smtp?.username || '',
    smtp_password: settings?.smtp?.password || '',
    smtp_from_email: settings?.smtp?.from_email || '',
    smtp_from_name: settings?.smtp?.from_name || 'Digital Services',
  });

  React.useEffect(() => {
    if (settings) {
      setFormData({
        smtp_host: settings?.smtp?.host || '',
        smtp_port: settings?.smtp?.port || 587,
        smtp_username: settings?.smtp?.username || '',
        smtp_password: settings?.smtp?.password || '',
        smtp_from_email: settings?.smtp?.from_email || '',
        smtp_from_name: settings?.smtp?.from_name || 'Digital Services',
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data) => {
      const settingsUpdate = {
        ...settings,
        smtp: {
          host: data.smtp_host,
          port: parseInt(data.smtp_port),
          username: data.smtp_username,
          password: data.smtp_password,
          from_email: data.smtp_from_email,
          from_name: data.smtp_from_name
        }
      };
      return adminAPI.updateSettings(settingsUpdate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-settings']);
      alert('SMTP settings saved!');
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: (email) => adminAPI.sendTestEmail(email),
    onSuccess: () => {
      setTestStatus('success');
      setTimeout(() => setTestStatus(null), 5000);
    },
    onError: (error) => {
      setTestStatus('error');
      alert('Failed to send test email: ' + (error.response?.data?.detail || error.message));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleTestEmail = () => {
    if (!testEmail) {
      alert('Please enter an email address');
      return;
    }
    if (!formData.smtp_host || !formData.smtp_username) {
      alert('Please configure and save SMTP settings first');
      return;
    }
    testEmailMutation.mutate(testEmail);
  };

  const isConfigured = formData.smtp_host && formData.smtp_username && formData.smtp_password;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600" />
          Email Settings (SMTP)
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Configure SMTP settings to enable automated email notifications
        </p>
      </div>

      {/* Status Indicator */}
      <div className={`p-4 rounded-lg ${isConfigured ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700'}`}>
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800 dark:text-green-200">SMTP Configured</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="font-medium text-yellow-800 dark:text-yellow-200">SMTP Not Configured - Emails will not be sent</span>
            </>
          )}
        </div>
      </div>

      {/* SMTP Settings */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
        <h4 className="font-semibold text-gray-900 dark:text-white">SMTP Server Configuration</h4>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              SMTP Host *
            </label>
            <input
              type="text"
              value={formData.smtp_host}
              onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
              placeholder="smtp.gmail.com"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              SMTP Port
            </label>
            <input
              type="number"
              value={formData.smtp_port}
              onChange={(e) => setFormData({ ...formData, smtp_port: e.target.value })}
              placeholder="587"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              SMTP Username *
            </label>
            <input
              type="text"
              value={formData.smtp_username}
              onChange={(e) => setFormData({ ...formData, smtp_username: e.target.value })}
              placeholder="your-email@gmail.com"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              SMTP Password *
            </label>
            <input
              type="password"
              value={formData.smtp_password}
              onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
              placeholder="App password"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              From Email *
            </label>
            <input
              type="email"
              value={formData.smtp_from_email}
              onChange={(e) => setFormData({ ...formData, smtp_from_email: e.target.value })}
              placeholder="noreply@yourdomain.com"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              From Name
            </label>
            <input
              type="text"
              value={formData.smtp_from_name}
              onChange={(e) => setFormData({ ...formData, smtp_from_name: e.target.value })}
              placeholder="Digital Services"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Gmail Users:</strong> Use an App Password instead of your regular password. 
            Go to Google Account → Security → 2-Step Verification → App Passwords to generate one.
          </p>
        </div>
      </div>

      {/* Test Email Section */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Test Email Configuration</h4>
        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter email to send test"
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            type="button"
            onClick={handleTestEmail}
            disabled={testEmailMutation.isPending || !isConfigured}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            <Send className="w-4 h-4" />
            {testEmailMutation.isPending ? 'Sending...' : 'Send Test'}
          </button>
        </div>
        {testStatus === 'success' && (
          <p className="mt-3 text-green-600 dark:text-green-400 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Test email sent successfully!
          </p>
        )}
      </div>

      {/* Automated Emails Info */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Automated Email Triggers</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          When SMTP is configured, the system will automatically send emails for:
        </p>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <strong>Order Confirmation</strong> - When a customer places an order
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <strong>Payment Received</strong> - When payment is confirmed
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <strong>Service Activated</strong> - With connection credentials
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            <strong>Expiry Warning</strong> - Before service expires
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            <strong>Order Cancelled</strong> - When admin cancels an order
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <strong>Ticket Updates</strong> - Reply notifications and closures
          </li>
        </ul>
      </div>

      <div className="pt-6">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
        >
          <Save className="w-5 h-5" />
          {updateMutation.isPending ? 'Saving...' : 'Save Email Settings'}
        </button>
      </div>
    </form>
  );
}
