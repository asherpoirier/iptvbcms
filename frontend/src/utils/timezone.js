import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Global timezone cache — persisted in localStorage
let cachedTimezone = localStorage.getItem('panel_timezone') || 'UTC';

export function useTimezone() {
  const { data } = useQuery({
    queryKey: ['panel-timezone'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/settings/branding`);
      const tz = res.data.timezone || 'UTC';
      cachedTimezone = tz;
      localStorage.setItem('panel_timezone', tz);
      return tz;
    },
    staleTime: 600000,
  });
  return data || cachedTimezone;
}

export function formatDate(dateInput, timezone) {
  if (!dateInput) return 'N/A';
  const tz = timezone || cachedTimezone || 'UTC';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { timeZone: tz, year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return new Date(dateInput).toLocaleDateString();
  }
}

export function formatDateTime(dateInput, timezone) {
  if (!dateInput) return 'N/A';
  const tz = timezone || cachedTimezone || 'UTC';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-US', { timeZone: tz, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return new Date(dateInput).toLocaleString();
  }
}

export function formatRelative(dateInput, timezone) {
  if (!dateInput) return 'N/A';
  const tz = timezone || cachedTimezone || 'UTC';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'N/A';
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 30) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -30) return `${Math.abs(diffDays)} days ago`;
    return formatDate(dateInput, tz);
  } catch {
    return 'N/A';
  }
}
