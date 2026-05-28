import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function getTimezone() {
  return localStorage.getItem('panel_timezone') || 'UTC';
}

export function useTimezone() {
  const { data } = useQuery({
    queryKey: ['panel-timezone'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/settings/branding`);
      const tz = res.data.timezone || 'UTC';
      localStorage.setItem('panel_timezone', tz);
      return tz;
    },
    staleTime: 60000, // 1 min cache — refresh more often
  });
  
  if (data && data !== getTimezone()) {
    localStorage.setItem('panel_timezone', data);
  }
  
  return data || getTimezone();
}

export function formatDate(dateInput, timezone) {
  if (!dateInput) return 'N/A';
  const tz = timezone || getTimezone();
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { timeZone: tz, year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    try { return new Date(dateInput).toLocaleDateString(); } catch { return 'N/A'; }
  }
}

export function formatDateTime(dateInput, timezone) {
  if (!dateInput) return 'N/A';
  const tz = timezone || getTimezone();
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-US', { timeZone: tz, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    try { return new Date(dateInput).toLocaleString(); } catch { return 'N/A'; }
  }
}

export function formatRelative(dateInput, timezone) {
  if (!dateInput) return 'N/A';
  const tz = timezone || getTimezone();
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
