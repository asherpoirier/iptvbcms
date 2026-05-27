import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Globe, Save } from 'lucide-react';
import { toast } from 'sonner';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET) - New York' },
  { value: 'America/Chicago', label: 'Central Time (CT) - Chicago' },
  { value: 'America/Denver', label: 'Mountain Time (MT) - Denver' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT) - Los Angeles' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: 'America/Toronto', label: 'Eastern Time - Toronto' },
  { value: 'America/Vancouver', label: 'Pacific Time - Vancouver' },
  { value: 'America/Edmonton', label: 'Mountain Time - Edmonton' },
  { value: 'America/Winnipeg', label: 'Central Time - Winnipeg' },
  { value: 'America/Halifax', label: 'Atlantic Time - Halifax' },
  { value: 'America/St_Johns', label: 'Newfoundland Time - St. Johns' },
  { value: 'Europe/London', label: 'GMT - London' },
  { value: 'Europe/Paris', label: 'CET - Paris' },
  { value: 'Europe/Berlin', label: 'CET - Berlin' },
  { value: 'Europe/Amsterdam', label: 'CET - Amsterdam' },
  { value: 'Europe/Rome', label: 'CET - Rome' },
  { value: 'Europe/Madrid', label: 'CET - Madrid' },
  { value: 'Europe/Moscow', label: 'MSK - Moscow' },
  { value: 'Europe/Istanbul', label: 'TRT - Istanbul' },
  { value: 'Asia/Dubai', label: 'GST - Dubai' },
  { value: 'Asia/Kolkata', label: 'IST - India' },
  { value: 'Asia/Singapore', label: 'SGT - Singapore' },
  { value: 'Asia/Hong_Kong', label: 'HKT - Hong Kong' },
  { value: 'Asia/Tokyo', label: 'JST - Tokyo' },
  { value: 'Asia/Shanghai', label: 'CST - Shanghai' },
  { value: 'Asia/Seoul', label: 'KST - Seoul' },
  { value: 'Australia/Sydney', label: 'AEST - Sydney' },
  { value: 'Australia/Melbourne', label: 'AEST - Melbourne' },
  { value: 'Australia/Perth', label: 'AWST - Perth' },
  { value: 'Pacific/Auckland', label: 'NZST - Auckland' },
  { value: 'Africa/Cairo', label: 'EET - Cairo' },
  { value: 'Africa/Johannesburg', label: 'SAST - Johannesburg' },
  { value: 'America/Sao_Paulo', label: 'BRT - São Paulo' },
  { value: 'America/Mexico_City', label: 'CST - Mexico City' },
  { value: 'America/Argentina/Buenos_Aires', label: 'ART - Buenos Aires' },
];

export default function TimezoneSettings({ settings }) {
  const queryClient = useQueryClient();
  const [timezone, setTimezone] = useState('UTC');

  useEffect(() => {
    if (settings?.timezone) setTimezone(settings.timezone);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => adminAPI.updateSettings({ ...settings, timezone }),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-settings']);
      toast.success('Timezone saved');
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to save'),
  });

  const now = new Date();
  let preview = '';
  try {
    preview = now.toLocaleString('en-US', { timeZone: timezone, dateStyle: 'full', timeStyle: 'long' });
  } catch { preview = now.toLocaleString(); }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Globe className="w-5 h-5" /> Timezone
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Set the timezone for all dates and times displayed in the panel</p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Panel Timezone</label>
          <select value={timezone} onChange={e => setTimezone(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            data-testid="timezone-select">
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>

        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-500 dark:text-gray-400">Current time in selected timezone:</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{preview}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
          data-testid="save-timezone-btn">
          <Save className="w-4 h-4" />{saveMutation.isPending ? 'Saving...' : 'Save Timezone'}
        </button>
      </div>
    </div>
  );
}

// Export timezone list for use in other components
export { TIMEZONES };
