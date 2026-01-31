import { create } from 'zustand';

// Load branding from localStorage immediately (synchronous)
const loadInitialBranding = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('app-branding');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored branding:', e);
      }
    }
  }
  return {
    site_name: 'IPTV Billing',
    logo_url: '',
    theme: 'light',
    primary_color: '#2563eb',
    secondary_color: '#7c3aed',
    accent_color: '#059669',
    hero_title: 'Premium IPTV Subscriptions',
    hero_description: 'Access thousands of channels with our reliable IPTV service. Flexible plans, instant activation, 24/7 support.',
    footer_text: 'Premium IPTV Services',
  };
};

const applyBrandingStyles = (branding) => {
  if (typeof document === 'undefined') return;
  
  // Set CSS variables
  document.documentElement.style.setProperty('--primary-color', branding.primary_color);
  document.documentElement.style.setProperty('--secondary-color', branding.secondary_color);
  document.documentElement.style.setProperty('--accent-color', branding.accent_color);
  
  // Update page title
  document.title = branding.site_name;
  
  // Apply dark theme
  if (branding.theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }
};

// Apply initial branding immediately
const initialBranding = loadInitialBranding();
applyBrandingStyles(initialBranding);

export const useBrandingStore = create((set, get) => ({
  branding: initialBranding,
  
  setBranding: (branding) => {
    set({ branding });
    localStorage.setItem('app-branding', JSON.stringify(branding));
    applyBrandingStyles(branding);
  },
  
  fetchBranding: async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const response = await fetch(`${backendUrl}/api/branding`);
      const data = await response.json();
      
      // Update store and apply
      get().setBranding(data);
      
      return data;
    } catch (error) {
      console.error('Failed to fetch branding:', error);
    }
  },
}));
