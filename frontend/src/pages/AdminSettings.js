import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft } from 'lucide-react';
import BrandingSettings from '../components/BrandingSettings';
import PanelManagement from '../components/PanelManagement';
import XuiOnePanelManagement from '../components/XuiOnePanelManagement';
import PaymentGatewaySettings from '../components/PaymentGatewaySettings';
import EmailProviderSettings from '../components/EmailProviderSettings';
import CreditReferralSettings from '../components/CreditReferralSettings';
import LicenseSettings from '../components/LicenseSettings';
import AdminPasswordChange from '../components/AdminPasswordChange';
import TwoFactorSetup from '../components/TwoFactorSetup';
import ChatbotSettings from '../components/ChatbotSettings';
import TimezoneSettings from '../components/TimezoneSettings';
import RefundSettings from '../components/RefundSettings';
import UpdateManager from '../components/UpdateManager';
import BackupManager from '../components/BackupManager';
import RecaptchaSettings from '../components/RecaptchaSettings';
import NotificationSettings from '../components/NotificationSettings';
import OneStreamPanelManagement from '../components/OneStreamPanelManagement';
import NxtDashPanelManagement from '../components/NxtDashPanelManagement';
import GhostSurfPanelManagement from '../components/GhostSurfPanelManagement';
import InvoiceSettings from '../components/InvoiceSettings';
import SEOSettings from '../components/SEOSettings';
import { toast } from 'sonner';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('panels');
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const response = await adminAPI.getSettings();
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <header className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/admin" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600">
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">System Settings</h1>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <nav className="bg-white dark:bg-gray-900 rounded-lg shadow p-2 space-y-1">
              <button
                onClick={() => setActiveTab('panels')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'panels' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                XtreamUI Panels
              </button>
              <button
                onClick={() => setActiveTab('xuione')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'xuione' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                XuiOne Panels
              </button>
              <button
                onClick={() => setActiveTab('onestream')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-between ${
                  activeTab === 'onestream' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                1-Stream Panels
              </button>
              <button
                onClick={() => setActiveTab('nxtdash')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-between ${
                  activeTab === 'nxtdash' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                NXT Dash Panels
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === 'nxtdash' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                }`}>New</span>
              </button>
              <button
                onClick={() => setActiveTab('ghostsurf')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-between ${
                  activeTab === 'ghostsurf' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                GhostSurf VPN
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === 'ghostsurf' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                }`}>New</span>
              </button>
              <button
                onClick={() => setActiveTab('branding')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'branding' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Branding
              </button>
              <button
                onClick={() => setActiveTab('payment')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'payment' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Payment Gateways
              </button>
              <button
                onClick={() => setActiveTab('email')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'email' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Email
              </button>
              <button
                onClick={() => setActiveTab('credits')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'credits' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Credits & Referrals
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'notifications' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Notifications
              </button>
              <button
                onClick={() => setActiveTab('refunds')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'refunds' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Refunds
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'invoices' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Invoices
              </button>
              <button
                onClick={() => setActiveTab('account')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'account' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                My Account
              </button>
              <button
                onClick={() => setActiveTab('2fa')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === '2fa' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Two-Factor Auth
              </button>
              <button
                onClick={() => setActiveTab('recaptcha')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'recaptcha' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                reCAPTCHA
              </button>
              <button
                onClick={() => setActiveTab('currency')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'currency' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Currency
              </button>
              <button
                onClick={() => setActiveTab('timezone')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'timezone' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Timezone
              </button>
              <button
                onClick={() => setActiveTab('license')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'license' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                License
              </button>
              <button
                onClick={() => setActiveTab('updates')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'updates' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Updates
              </button>
              <button
                onClick={() => setActiveTab('backups')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'backups' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Backups
              </button>
              <button
                onClick={() => setActiveTab('seo')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'seo' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                SEO
              </button>
              <button
                onClick={() => setActiveTab('chatbot')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'chatbot' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                AI Chatbot
              </button>
            </nav>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3 bg-white dark:bg-gray-900 rounded-lg shadow">
            <div className="p-6">
            {/* Panels Tab - Uses PanelManagement component */}
            {activeTab === 'panels' && (
              <PanelManagement settings={settings} />
            )}

            {/* XuiOne Panels Tab */}
            {activeTab === 'xuione' && (
              <XuiOnePanelManagement settings={settings} />
            )}

            {/* 1-Stream Panels Tab */}
            {activeTab === 'onestream' && (
              <OneStreamPanelManagement settings={settings} />
            )}

            {/* NXT Dash Panels Tab */}
            {activeTab === 'nxtdash' && (
              <NxtDashPanelManagement settings={settings} />
            )}

            {/* GhostSurf VPN Tab */}
            {activeTab === 'ghostsurf' && (
              <GhostSurfPanelManagement settings={settings} />
            )}

            {/* Branding Tab */}
            {activeTab === 'branding' && (
              <BrandingSettings settings={settings} />
            )}

            {/* Payment Gateway Tab */}
            {activeTab === 'payment' && (
              <PaymentGatewaySettings settings={settings} />
            )}

            {/* Email Tab (combined SMTP + Provider) */}
            {activeTab === 'email' && (
              <EmailProviderSettings settings={settings} />
            )}

            {/* Credits & Referrals Tab */}
            {activeTab === 'credits' && (
              <CreditReferralSettings settings={settings} />
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <NotificationSettings settings={settings} />
            )}
            
            {/* Refunds Tab */}
            {activeTab === 'refunds' && (
              <RefundSettings settings={settings} />
            )}

            {/* Invoices Tab */}
            {activeTab === 'invoices' && (
              <InvoiceSettings settings={settings} />
            )}
            
            {/* My Account Tab */}
            {activeTab === 'account' && (
              <AdminPasswordChange />
            )}
            
            {/* Two-Factor Auth Tab */}
            {activeTab === '2fa' && (
              <TwoFactorSetup />
            )}
            
            {/* reCAPTCHA Tab */}
            {activeTab === 'recaptcha' && (
              <RecaptchaSettings settings={settings} />
            )}

            {/* Currency Tab */}
            {activeTab === 'currency' && (
              <CurrencySettings settings={settings} />
            )}

            {/* License Tab */}
            {activeTab === 'license' && (
              <LicenseSettings settings={settings} />
            )}
            
            {/* Updates Tab */}
            {activeTab === 'updates' && (
              <UpdateManager />
            )}
            
            {/* Backups Tab */}
            {activeTab === 'backups' && (
              <BackupManager />
            )}

            {/* SEO Tab */}
            {activeTab === 'seo' && (
              <SEOSettings settings={settings} />
            )}

            {activeTab === 'timezone' && (
              <TimezoneSettings settings={settings} />
            )}

            {activeTab === 'chatbot' && (
              <ChatbotSettings settings={settings} />
            )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


function CurrencySettings({ settings }) {
  const [selected, setSelected] = React.useState(settings?.currency || 'USD');
  const [loading, setLoading] = React.useState(false);
  const queryClient = React.useMemo(() => require('@tanstack/react-query').useQueryClient, []);

  const currencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'EUR', symbol: '\u20ac', name: 'Euro' },
  ];

  const current = settings?.currency || 'USD';

  const handleChange = async () => {
    if (selected === current) return;
    if (!window.confirm(`Change currency from ${current} to ${selected}?\n\nThis will convert ALL existing product prices using current exchange rates. This action cannot be easily undone.`)) return;
    setLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token;
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/currency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currency: selected })
      });
      const data = await res.json();
      if (res.ok) {
        toast.info(`${data.message}\n\nConversion factor: ${data.conversion_factor}`);
        window.location.reload();
      } else {
        toast.error('Error: ' + (data.detail || 'Failed'));
      }
    } catch (e) {
      toast.error('Error: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Currency</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Set the system-wide currency for all prices and invoices</p>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">Current currency: <span className="font-bold text-lg">{current}</span></p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {currencies.map((c) => (
            <button key={c.code} type="button"
              onClick={() => setSelected(c.code)}
              className={`p-4 rounded-lg border-2 text-center transition ${
                selected === c.code
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
              }`}>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.symbol}</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{c.code}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.name}</p>
            </button>
          ))}
        </div>

        {selected !== current && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Warning:</strong> Changing currency will convert all existing product prices from {current} to {selected} using current exchange rates. Review your prices after conversion.
            </p>
          </div>
        )}

        <button onClick={handleChange}
          disabled={loading || selected === current}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50">
          {loading ? 'Converting...' : selected === current ? `Current: ${current}` : `Switch to ${selected}`}
        </button>
      </div>
    </div>
  );
}
