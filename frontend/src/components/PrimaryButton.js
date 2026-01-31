import React from 'react';
import { useBrandingStore } from '../store/branding';

export default function PrimaryButton({ children, className = '', ...props }) {
  const { branding } = useBrandingStore();

  return (
    <button
      className={`px-4 py-2 rounded-lg text-white font-semibold hover:opacity-90 transition ${className}`}
      style={{ backgroundColor: branding.primary_color }}
      {...props}
    >
      {children}
    </button>
  );
}
