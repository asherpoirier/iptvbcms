import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import axios from 'axios';
import { Bot, ExternalLink, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function ChatbotSettings({ settings }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [widgetKey, setWidgetKey] = useState('');
  const [apiUrl, setApiUrl] = useState('https://banterbot.ai');

  useEffect(() => {
    if (settings?.chatbot) {
      setEnabled(settings.chatbot.enabled || false);
      setWidgetKey(settings.chatbot.widget_key || '');
      setApiUrl(settings.chatbot.api_url || 'https://banterbot.ai');
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => axios.put(`${process.env.REACT_APP_BACKEND_URL}/api/admin/chatbot`,
      { enabled, widget_key: widgetKey, api_url: apiUrl },
      { headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token}` }}
    ),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-settings']);
      toast.success('Chatbot settings saved');
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to save'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Bot className="w-5 h-5" /> AI Chatbot
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Add an AI chatbot widget to your billing panel for customer support
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white text-sm">Enable Chatbot</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Show chat widget in the bottom-right corner for all visitors</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
              className="sr-only peer" data-testid="chatbot-enabled" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Widget Key</label>
          <input type="text" value={widgetKey} onChange={e => setWidgetKey(e.target.value)}
            placeholder="Enter your BanterBot widget key"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            data-testid="chatbot-widget-key" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Get your widget key from{' '}
            <a href="https://banterbot.ai" target="_blank" rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
              banterbot.ai <ExternalLink className="w-3 h-3" />
            </a>
            {' '}&rarr; Deployments &rarr; Create Deployment &rarr; Website Widget
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API URL</label>
          <input type="text" value={apiUrl} onChange={e => setApiUrl(e.target.value)}
            placeholder="https://banterbot.ai"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            data-testid="chatbot-api-url" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: https://banterbot.ai — only change if using a custom instance</p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 dark:text-blue-200 text-sm mb-2">How it works</h3>
        <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
          <li>A chat bubble appears in the bottom-right corner of your site</li>
          <li>Visitors click the bubble to open the chat window</li>
          <li>Responses stream in real-time</li>
          <li>The widget remembers conversations across page visits</li>
          <li>On mobile, the chat opens fullscreen automatically</li>
        </ul>
      </div>

      <div className="flex justify-end">
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
          data-testid="save-chatbot-btn">
          <Save className="w-4 h-4" />{saveMutation.isPending ? 'Saving...' : 'Save Chatbot Settings'}
        </button>
      </div>
    </div>
  );
}
