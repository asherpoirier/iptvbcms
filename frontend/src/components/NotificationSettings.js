import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Bell, Send, MessageSquare, Mail, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const eventLabels = {
  new_order: { label: 'New Order', description: 'When a customer places a new order' },
  payment_received: { label: 'Payment Received', description: 'When a payment is confirmed' },
  new_user_registration: { label: 'New User Registration', description: 'When a new user signs up' },
  service_activated: { label: 'Service Activated', description: 'When a service is activated for a customer' },
  service_expired: { label: 'Service Expired', description: 'When a service expires' },
  service_expiry_warning: { label: 'Expiry Reminders', description: 'When a service is about to expire (7, 3, 1 day warnings)' },
  credit_low_alert: { label: 'Low Panel Credits', description: 'When IPTV panel credits drop below threshold' },
  new_support_ticket: { label: 'New Support Ticket', description: 'When a customer creates a support ticket' },
  ticket_reply: { label: 'Ticket Reply', description: 'When a customer replies to a ticket' }
};

const defaultEvents = {
  new_order: true,
  payment_received: true,
  new_user_registration: true,
  service_activated: true,
  service_expired: false,
  service_expiry_warning: true,
  credit_low_alert: true,
  new_support_ticket: true,
  ticket_reply: false
};

function EventToggles({ events, onToggle, idPrefix }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {Object.entries(eventLabels).map(([key, { label, description }]) => (
        <label
          key={key}
          className="flex items-start gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-blue-400 transition-colors"
        >
          <input
            type="checkbox"
            checked={events[key] || false}
            onChange={() => onToggle(key)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            data-testid={`${idPrefix}-event-${key}`}
          />
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
          </div>
        </label>
      ))}
    </div>
  );
}

export default function NotificationSettings({ settings }) {
  const queryClient = useQueryClient();
  const [telegramConfig, setTelegramConfig] = useState({
    enabled: false,
    bot_token: '',
    chat_id: '',
    events: { ...defaultEvents }
  });
  const [emailConfig, setEmailConfig] = useState({
    enabled: false,
    recipient_email: '',
    events: { ...defaultEvents }
  });
  const [smsConfig, setSmsConfig] = useState({
    enabled: false,
    provider: 'twilio',
    admin_phone: '',
    config: {},
    events: { ...defaultEvents }
  });
  const [creditThreshold, setCreditThreshold] = useState(10);
  const [telegramTestStatus, setTelegramTestStatus] = useState(null);
  const [emailTestStatus, setEmailTestStatus] = useState(null);
  const [smsTestStatus, setSmsTestStatus] = useState(null);

  const { data: notificationSettings, isLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const response = await adminAPI.getNotificationSettings();
      return response.data;
    },
  });

  useEffect(() => {
    if (notificationSettings?.telegram) {
      setTelegramConfig(prev => ({ ...prev, ...notificationSettings.telegram }));
    }
    if (notificationSettings?.email) {
      setEmailConfig(prev => ({ ...prev, ...notificationSettings.email }));
    }
    if (notificationSettings?.sms) {
      setSmsConfig(prev => ({ ...prev, ...notificationSettings.sms }));
    }
    if (settings?.credit_alert_threshold !== undefined) {
      setCreditThreshold(settings.credit_alert_threshold);
    }
  }, [notificationSettings, settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await adminAPI.updateTelegramSettings(telegramConfig);
      await adminAPI.updateEmailNotificationSettings(emailConfig);
      await adminAPI.updateSmsNotificationSettings(smsConfig);
      const { notifications, ...settingsWithoutNotifications } = (settings || {});
      await adminAPI.updateSettings({ ...settingsWithoutNotifications, credit_alert_threshold: creditThreshold });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notification-settings']);
      toast.success('Notification settings saved successfully!');
    },
    onError: (error) => {
      toast.error('Failed to save settings: ' + (error.response?.data?.detail || error.message));
    },
  });

  const telegramTestMutation = useMutation({
    mutationFn: (data) => adminAPI.testTelegramNotification(data),
    onSuccess: () => {
      setTelegramTestStatus('success');
      setTimeout(() => setTelegramTestStatus(null), 3000);
    },
    onError: (error) => {
      setTelegramTestStatus('error');
      toast.error('Telegram test failed: ' + (error.response?.data?.detail || error.message));
      setTimeout(() => setTelegramTestStatus(null), 3000);
    },
  });

  const emailTestMutation = useMutation({
    mutationFn: (data) => adminAPI.testEmailNotification(data),
    onSuccess: () => {
      setEmailTestStatus('success');
      setTimeout(() => setEmailTestStatus(null), 3000);
    },
    onError: (error) => {
      setEmailTestStatus('error');
      toast.error('Email test failed: ' + (error.response?.data?.detail || error.message));
      setTimeout(() => setEmailTestStatus(null), 3000);
    },
  });

  const smsTestMutation = useMutation({
    mutationFn: (data) => adminAPI.testSmsNotification(data),
    onSuccess: () => {
      setSmsTestStatus('success');
      setTimeout(() => setSmsTestStatus(null), 3000);
    },
    onError: (error) => {
      setSmsTestStatus('error');
      toast.error('SMS test failed: ' + (error.response?.data?.detail || error.message));
      setTimeout(() => setSmsTestStatus(null), 3000);
    },
  });

  const handleTelegramEventToggle = (event) => {
    setTelegramConfig(prev => ({ ...prev, events: { ...prev.events, [event]: !prev.events[event] } }));
  };

  const handleEmailEventToggle = (event) => {
    setEmailConfig(prev => ({ ...prev, events: { ...prev.events, [event]: !prev.events[event] } }));
  };

  const handleSmsEventToggle = (event) => {
    setSmsConfig(prev => ({ ...prev, events: { ...prev.events, [event]: !prev.events[event] } }));
  };

  const smsProviders = [
    { id: 'twilio', name: 'Twilio', fields: [
      { key: 'twilio_account_sid', label: 'Account SID', placeholder: 'ACxxxxxxxx' },
      { key: 'twilio_auth_token', label: 'Auth Token', placeholder: 'Your auth token', type: 'password' },
      { key: 'twilio_from_number', label: 'From Number', placeholder: '+15551234567' },
    ]},
    { id: 'vonage', name: 'Vonage (Nexmo)', fields: [
      { key: 'vonage_api_key', label: 'API Key', placeholder: 'Your API key' },
      { key: 'vonage_api_secret', label: 'API Secret', placeholder: 'Your API secret', type: 'password' },
      { key: 'vonage_from_name', label: 'From Name/Number', placeholder: 'Billing or +15551234567' },
    ]},
    { id: 'plivo', name: 'Plivo', fields: [
      { key: 'plivo_auth_id', label: 'Auth ID', placeholder: 'Your auth ID' },
      { key: 'plivo_auth_token', label: 'Auth Token', placeholder: 'Your auth token', type: 'password' },
      { key: 'plivo_from_number', label: 'From Number', placeholder: '+15551234567' },
    ]},
    { id: 'aws_sns', name: 'AWS SNS', fields: [
      { key: 'aws_access_key', label: 'Access Key', placeholder: 'AKIA...' },
      { key: 'aws_secret_key', label: 'Secret Key', placeholder: 'Your secret key', type: 'password' },
      { key: 'aws_region', label: 'Region', placeholder: 'us-east-1' },
    ]},
  ];

  const currentSmsProvider = smsProviders.find(p => p.id === smsConfig.provider) || smsProviders[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure how you receive notifications about important events
        </p>
      </div>

      {/* Email Notifications Section */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Email Notifications</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Receive admin notifications via email</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={emailConfig.enabled}
              onChange={(e) => setEmailConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer"
              data-testid="email-notif-enabled"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Recipient Email
            </label>
            <input
              type="email"
              value={emailConfig.recipient_email}
              onChange={(e) => setEmailConfig(prev => ({ ...prev, recipient_email: e.target.value }))}
              placeholder="admin@yoursite.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              data-testid="email-notif-recipient"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              The email address where admin notifications will be sent. Requires SMTP to be configured in Email Settings.
            </p>
          </div>

          {/* Test Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => emailTestMutation.mutate({ recipient_email: emailConfig.recipient_email })}
              disabled={emailTestMutation.isPending || !emailConfig.recipient_email}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="email-notif-test-btn"
            >
              <Send className="w-4 h-4" />
              {emailTestMutation.isPending ? 'Sending...' : 'Send Test Email'}
            </button>
            {emailTestStatus === 'success' && (
              <span className="flex items-center text-green-600 text-sm">
                <CheckCircle className="w-4 h-4 mr-1" /> Email sent!
              </span>
            )}
            {emailTestStatus === 'error' && (
              <span className="flex items-center text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 mr-1" /> Failed to send
              </span>
            )}
          </div>
        </div>

        {/* Event Triggers */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Notification Events</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose which events should trigger an email notification</p>
          <EventToggles events={emailConfig.events} onToggle={handleEmailEventToggle} idPrefix="email" />
        </div>
      </div>

      {/* SMS Section */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Smartphone className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">SMS Notifications</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications via text message</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={smsConfig.enabled}
              onChange={(e) => setSmsConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer" data-testid="sms-enabled" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMS Provider</label>
            <select value={smsConfig.provider}
              onChange={e => setSmsConfig(prev => ({ ...prev, provider: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              data-testid="sms-provider-select">
              {smsProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Admin Phone Number</label>
            <input type="tel" value={smsConfig.admin_phone}
              onChange={e => setSmsConfig(prev => ({ ...prev, admin_phone: e.target.value }))}
              placeholder="+15551234567"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              data-testid="sms-admin-phone" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Phone number where admin notifications will be sent (E.164 format)</p>
          </div>
          {currentSmsProvider.fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
              <input type={field.type || 'text'}
                value={smsConfig.config?.[field.key] || ''}
                onChange={e => setSmsConfig(prev => ({ ...prev, config: { ...prev.config, [field.key]: e.target.value } }))}
                placeholder={field.placeholder}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                data-testid={`sms-${field.key}`} />
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button
              onClick={() => smsTestMutation.mutate({ phone: smsConfig.admin_phone, provider: smsConfig.provider, config: smsConfig.config })}
              disabled={smsTestMutation.isPending || !smsConfig.admin_phone}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="sms-test-btn">
              <Send className="w-4 h-4" />
              {smsTestMutation.isPending ? 'Sending...' : 'Send Test SMS'}
            </button>
            {smsTestStatus === 'success' && <span className="flex items-center text-green-600 text-sm"><CheckCircle className="w-4 h-4 mr-1" /> Sent</span>}
            {smsTestStatus === 'error' && <span className="flex items-center text-red-600 text-sm"><AlertCircle className="w-4 h-4 mr-1" /> Failed</span>}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Notification Events</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose which events should trigger an SMS notification</p>
          <EventToggles events={smsConfig.events} onToggle={handleSmsEventToggle} idPrefix="sms" />
        </div>
      </div>

      {/* Telegram Section */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Telegram Notifications</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Receive instant notifications via Telegram</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={telegramConfig.enabled}
              onChange={(e) => setTelegramConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer"
              data-testid="telegram-enabled"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bot Token</label>
            <input
              type="text"
              value={telegramConfig.bot_token}
              onChange={(e) => setTelegramConfig(prev => ({ ...prev, bot_token: e.target.value }))}
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              data-testid="telegram-bot-token"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Get your bot token from <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">@BotFather</a>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chat ID</label>
            <input
              type="text"
              value={telegramConfig.chat_id}
              onChange={(e) => setTelegramConfig(prev => ({ ...prev, chat_id: e.target.value }))}
              placeholder="-1001234567890 or 123456789"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              data-testid="telegram-chat-id"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your personal chat ID or group chat ID. Get it from <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">@userinfobot</a>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => telegramTestMutation.mutate({ bot_token: telegramConfig.bot_token, chat_id: telegramConfig.chat_id })}
              disabled={telegramTestMutation.isPending || !telegramConfig.bot_token || !telegramConfig.chat_id}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="telegram-test-btn"
            >
              <Send className="w-4 h-4" />
              {telegramTestMutation.isPending ? 'Sending...' : 'Send Test Message'}
            </button>
            {telegramTestStatus === 'success' && (
              <span className="flex items-center text-green-600 text-sm">
                <CheckCircle className="w-4 h-4 mr-1" /> Message sent!
              </span>
            )}
            {telegramTestStatus === 'error' && (
              <span className="flex items-center text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 mr-1" /> Failed to send
              </span>
            )}
          </div>
        </div>

        {/* Event Triggers */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Notification Events</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose which events should trigger a Telegram notification</p>
          <EventToggles events={telegramConfig.events} onToggle={handleTelegramEventToggle} idPrefix="telegram" />
        </div>
      </div>

      {/* Credit Alert Threshold */}
      {(telegramConfig.events?.credit_low_alert || emailConfig.events?.credit_low_alert || smsConfig.events?.credit_low_alert) && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <label className="block text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
            Credit Alert Threshold
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="1"
              value={creditThreshold}
              onChange={(e) => setCreditThreshold(parseInt(e.target.value) || 10)}
              className="w-24 px-3 py-2 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="credit-threshold-input"
            />
            <span className="text-sm text-amber-700 dark:text-amber-300">credits - alert when any panel drops below this</span>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          data-testid="save-notifications-btn"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Notification Settings'}
        </button>
      </div>
    </div>
  );
}
