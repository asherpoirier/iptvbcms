import React from 'react';
import { Link } from 'react-router-dom';
import { useBrandingStore } from '../store/branding';
import { Server } from 'lucide-react';

export default function Header({ children }) {
  const { branding } = useBrandingStore();

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.site_name} className="h-8" />
            ) : (
              <Server className="w-8 h-8" style={{ color: branding.primary_color }} />
            )}
            <h1 className="text-2xl font-bold text-gray-900">{branding.site_name}</h1>
          </Link>
          {children}
        </div>
      </div>
    </header>
  );
}
