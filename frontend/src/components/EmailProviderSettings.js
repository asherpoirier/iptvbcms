import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Mail, Send, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';

const PROVIDERS = [
  { id: 'smtp', name: 'Custom SMTP', desc: 'Use your own SMTP server (Gmail, ProtonMail, etc.)' },
  { id: 'resend', name: 'Resend', desc: 'Simple API, 100 emails/day free tier' },
  { id: 'postmark', name: 'Postmark', desc: 'Best deliverability for transactional email' },
  { id: 'mailgun', name: 'Mailgun', desc: 'Flexible API with analytics' },
  { id: 'mandrill', name: 'Mandrill (Mailchimp)', desc: 'Mailchimp transactional email service' },
];

const PROVIDER_FIELDS = {
  resend: [
    { key: 'resend_api_key', label: 'API Key', type: 'password', placeholder: 're_...' },
    { key: 'from_email', label: 'From Email', type: 'email', placeholder: 'noreply@yourdomain.com' },
    { key: 'from_name', label: 'From Name', type: 'text', placeholder: 'Your Company' },
  ],
  postmark: [
    { key: 'postmark_server_token', label: 'Server Token', type: 'password', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    { key: 'from_email', label: 'From Email', type: 'email', placeholder: 'noreply@yourdomain.com' },
    { key: 'from_name', label: 'From Name', type: 'text', placeholder: 'Your Company' },
  ],
  mailgun: [
    { key: 'mailgun_api_key', label: 'API Key', type: 'password', placeholder: 'key-...' },
    { key: 'mailgun_domain', label: 'Sending Domain', type: 'text', placeholder: 'mg.yourdomain.com' },
    { key: 'mailgun_region', label: 'Region', type: 'select', options: [{ value: 'us', label: 'US' }, { value: 'eu', label: 'EU' }] },
    { key: 'from_email', label: 'From Email', type: 'email', placeholder: 'noreply@yourdomain.com' },
    { key: 'from_name', label: 'From Name', type: 'text', placeholder: 'Your Company' },
  ],
  mandrill: [
    { key: 'mandrill_api_key', label: 'API Key', type: 'password', placeholder: 'Your Mandrill API key' },
    { key: 'from_email', label: 'From Email', type: 'email', placeholder: 'noreply@yourdomain.com' },
    { key: 'from_name', label: 'From Name', type: 'text', placeholder: 'Your Company' },
  ],
};

export default function EmailProviderSettings({ settings }) {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState('smtp');
  const [config, setConfig] = useState({});
  const [smtpData, setSmtpData] = useState({
    host: '', port: 587, username: '', password: '', from_email: '', from_name: '',
  });
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState(null);

  const { data: providerData, isLoading } = useQuery({
    queryKey: ['email-provider'],
    queryFn: async () => { const res = await adminAPI.getEmailProvider(); return res.data; },
  });

  useEffect(() => {
    if (providerData) {
      setProvider(providerData.email_provider || 'smtp');
      setConfig(providerData.email_provider_config || {});
    }
  }, [providerData]);

  useEffect(() => {
    if (settings?.smtp) {
      setSmtpData({
        host: settings.smtp.host || '',
        port: settings.smtp.port || 587,
        username: settings.smtp.username || '',
        password: settings.smtp.password || '',
        from_email: settings.smtp.from_email || '',
        from_name: settings.smtp.from_name || '',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await adminAPI.updateEmailProvider({ email_provider: provider, email_provider_config: config });
      if (provider === 'smtp') {
        const settingsUpdate = { ...settings, smtp: {
          host: smtpData.host, port: parseInt(smtpData.port),
          username: smtpData.username, password: smtpData.password,
          from_email: smtpData.from_email, from_name: smtpData.from_name
        }};
        await adminAPI.updateSettings(settingsUpdate);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['email-provider', 'admin-settings']);
      toast.success('Email settings saved');
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to save'),
  });

  const testMutation = useMutation({
    mutationFn: () => {
      if (provider === 'smtp') {
        return adminAPI.sendTestEmail(testEmail);
      }
      return adminAPI.testEmailProvider({ test_email: testEmail, email_provider: provider, email_provider_config: config });
    },
    onSuccess: () => { setTestStatus('success'); setTimeout(() => setTestStatus(null), 3000); },
    onError: (err) => {
      setTestStatus('error');
      toast.error(err.response?.data?.detail || 'Test failed');
      setTimeout(() => setTestStatus(null), 3000);
    },
  });

  const fields = PROVIDER_FIELDS[provider] || [];
  const smtpConfigured = smtpData.host && smtpData.username && smtpData.password;
  const apiConfigured = provider !== 'smtp' && config && Object.values(config).some(v => v);

  if (isLoading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Mail className="w-5 h-5" /> Email Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Configure how your system sends emails</p>
      </div>

      {/* Provider Selection */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map(p => (
          <label key={p.id}
            className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${provider === p.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}
            data-testid={`provider-${p.id}`}>
            <input type="radio" name="email_provider" value={p.id} checked={provider === p.id}
              onChange={() => setProvider(p.id)} className="h-4 w-4 text-blue-600 mt-0.5" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white text-sm">{p.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{p.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {/* SMTP Config (shown when Custom SMTP selected) */}
      {provider === 'smtp' && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-white text-sm">SMTP Server Configuration</h3>
            {smtpConfigured ? (
              <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3.5 h-3.5" /> Configured</span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-yellow-600"><AlertCircle className="w-3.5 h-3.5" /> Not configured</span>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Host *</label>
              <input type="text" value={smtpData.host} onChange={e => setSmtpData({ ...smtpData, host: e.target.value })}
                placeholder="smtp.gmail.com" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Port</label>
              <input type="number" value={smtpData.port} onChange={e => setSmtpData({ ...smtpData, port: e.target.value })}
                placeholder="587" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Username *</label>
              <input type="text" value={smtpData.username} onChange={e => setSmtpData({ ...smtpData, username: e.target.value })}
                placeholder="user@example.com" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Password *</label>
              <input type="password" value={smtpData.password} onChange={e => setSmtpData({ ...smtpData, password: e.target.value })}
                placeholder="App password or SMTP token" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Email *</label>
              <input type="email" value={smtpData.from_email} onChange={e => setSmtpData({ ...smtpData, from_email: e.target.value })}
                placeholder="noreply@yourdomain.com" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Name</label>
              <input type="text" value={smtpData.from_name} onChange={e => setSmtpData({ ...smtpData, from_name: e.target.value })}
                placeholder="Your Company" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
            <strong>Gmail Users:</strong> Use an App Password instead of your regular password. Go to Google Account &rarr; Security &rarr; 2-Step Verification &rarr; App Passwords.
          </p>
        </div>
      )}

      {/* API Provider Config */}
      {provider !== 'smtp' && fields.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5 space-y-4">
          <h3 className="font-medium text-gray-900 dark:text-white text-sm">{PROVIDERS.find(p => p.id === provider)?.name} Configuration</h3>
          {fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
              {field.type === 'select' ? (
                <select value={config[field.key] || field.options[0].value}
                  onChange={e => setConfig({ ...config, [field.key]: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" data-testid={`config-${field.key}`}>
                  {field.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              ) : (
                <input type={field.type} value={config[field.key] || ''} onChange={e => setConfig({ ...config, [field.key]: e.target.value })}
                  placeholder={field.placeholder} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" data-testid={`config-${field.key}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Test Email */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5 space-y-3">
        <h3 className="font-medium text-gray-900 dark:text-white text-sm">Send Test Email</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Test email will use sample data for all variables</p>
        <div className="flex gap-3">
          <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" data-testid="email-test-input" />
          <button onClick={() => testMutation.mutate()} disabled={testMutation.isPending || !testEmail}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm" data-testid="email-test-btn">
            <Send className="w-4 h-4" />{testMutation.isPending ? 'Sending...' : 'Send Test'}
          </button>
          {testStatus === 'success' && <span className="flex items-center text-green-600 text-sm"><CheckCircle className="w-4 h-4 mr-1" /> Sent</span>}
          {testStatus === 'error' && <span className="flex items-center text-red-600 text-sm"><AlertCircle className="w-4 h-4 mr-1" /> Failed</span>}
        </div>
      </div>

      {/* Email Triggers Info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5">
        <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-3">Automated Email Triggers</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">When email is configured, the system will automatically send emails for:</p>
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          {[
            { name: 'Order Confirmation', color: 'text-green-600' },
            { name: 'Payment Received', color: 'text-green-600' },
            { name: 'Service Activated', color: 'text-green-600' },
            { name: 'Expiry Warning', color: 'text-amber-600' },
            { name: 'Order Cancelled', color: 'text-red-600' },
            { name: 'Ticket Updates', color: 'text-blue-600' },
          ].map(t => (
            <div key={t.name} className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${t.color.replace('text-', 'bg-')}`} />
              <span className="text-gray-700 dark:text-gray-300">{t.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold" data-testid="save-email-btn">
          <Save className="w-4 h-4" />{saveMutation.isPending ? 'Saving...' : 'Save Email Settings'}
        </button>
      </div>
    </div>
  );
}
