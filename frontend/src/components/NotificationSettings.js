import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Bell, Send, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';

export default function NotificationSettings({ settings }) {
  const queryClient = useQueryClient();
  const [telegramConfig, setTelegramConfig] = useState({
    enabled: false,
    bot_token: '',
    chat_id: '',
    events: {
      new_order: true,
      payment_received: true,
      new_user: true,
      service_activated: true,
      service_expired: false,
      ticket_created: true,
      ticket_replied: false
    }
  });
  const [testStatus, setTestStatus] = useState(null);

  // Fetch notification settings
  const { data: notificationSettings, isLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const response = await adminAPI.getNotificationSettings();
      return response.data;
    },
  });

  // Update local state when settings are fetched
  useEffect(() => {
    if (notificationSettings?.telegram) {
      setTelegramConfig(notificationSettings.telegram);
    }
  }, [notificationSettings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (data) => adminAPI.updateTelegramSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['notification-settings']);
      alert('Telegram settings saved successfully!');
    },
    onError: (error) => {
      alert('Failed to save settings: ' + (error.response?.data?.detail || error.message));
    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: (data) => adminAPI.testTelegramNotification(data),
    onSuccess: () => {
      setTestStatus('success');
      setTimeout(() => setTestStatus(null), 3000);
    },
    onError: (error) => {
      setTestStatus('error');
      alert('Test failed: ' + (error.response?.data?.detail || error.message));
      setTimeout(() => setTestStatus(null), 3000);
    },
  });

  const handleSave = () => {
    saveMutation.mutate(telegramConfig);
  };

  const handleTest = () => {
    if (!telegramConfig.bot_token || !telegramConfig.chat_id) {
      alert('Please enter both Bot Token and Chat ID before testing');
      return;
    }
    testMutation.mutate({
      bot_token: telegramConfig.bot_token,
      chat_id: telegramConfig.chat_id
    });
  };

  const handleEventToggle = (event) => {
    setTelegramConfig(prev => ({
      ...prev,
      events: {
        ...prev.events,
        [event]: !prev.events[event]
      }
    }));
  };

  const eventLabels = {
    new_order: { label: 'New Order', description: 'When a customer places a new order' },
    payment_received: { label: 'Payment Received', description: 'When a payment is confirmed' },
    new_user: { label: 'New User Registration', description: 'When a new user signs up' },
    service_activated: { label: 'Service Activated', description: 'When a service is activated for a customer' },
    service_expired: { label: 'Service Expired', description: 'When a service expires' },
    ticket_created: { label: 'New Support Ticket', description: 'When a customer creates a support ticket' },
    ticket_replied: { label: 'Ticket Reply', description: 'When a customer replies to a ticket' }
  };

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

        {/* Configuration Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bot Token
            </label>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Chat ID
            </label>
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

          {/* Test Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testMutation.isPending || !telegramConfig.bot_token || !telegramConfig.chat_id}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="telegram-test-btn"
            >
              <Send className="w-4 h-4" />
              {testMutation.isPending ? 'Sending...' : 'Send Test Message'}
            </button>
            {testStatus === 'success' && (
              <span className="flex items-center text-green-600 text-sm">
                <CheckCircle className="w-4 h-4 mr-1" />
                Message sent!
              </span>
            )}
            {testStatus === 'error' && (
              <span className="flex items-center text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 mr-1" />
                Failed to send
              </span>
            )}
          </div>
        </div>

        {/* Event Triggers */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            Notification Events
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Choose which events should trigger a Telegram notification
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(eventLabels).map(([key, { label, description }]) => (
              <label
                key={key}
                className="flex items-start gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-blue-400 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={telegramConfig.events[key] || false}
                  onChange={() => handleEventToggle(key)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  data-testid={`event-${key}`}
                />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
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
