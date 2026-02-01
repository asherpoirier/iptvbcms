import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft } from 'lucide-react';
import BrandingSettings from '../components/BrandingSettings';
import PanelManagement from '../components/PanelManagement';
import PaymentGatewaySettings from '../components/PaymentGatewaySettings';
import EmailSettings from '../components/EmailSettings';
import CreditReferralSettings from '../components/CreditReferralSettings';
import LicenseSettings from '../components/LicenseSettings';

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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">System Settings</h1>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('panels')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'panels' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                data-testid="tab-panels"
              >
                XtreamUI Panels
              </button>
              <button
                onClick={() => setActiveTab('branding')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'branding' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                data-testid="tab-branding"
              >
                Branding
              </button>
              <button
                onClick={() => setActiveTab('payment')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'payment' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                data-testid="tab-payment"
              >
                Payment Gateways
              </button>
              <button
                onClick={() => setActiveTab('smtp')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'smtp' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                data-testid="tab-smtp"
              >
                Email (SMTP)
              </button>
              <button
                onClick={() => setActiveTab('credits')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'credits' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                data-testid="tab-credits"
              >
                Credits & Referrals
              </button>
              <button
                onClick={() => setActiveTab('license')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'license' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                data-testid="tab-license"
              >
                License
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Panels Tab - Uses PanelManagement component */}
            {activeTab === 'panels' && (
              <PanelManagement settings={settings} />
            )}

            {/* Branding Tab */}
            {activeTab === 'branding' && (
              <BrandingSettings settings={settings} />
            )}

            {/* Payment Gateway Tab */}
            {activeTab === 'payment' && (
              <PaymentGatewaySettings settings={settings} />
            )}

            {/* SMTP Tab */}
            {activeTab === 'smtp' && (
              <EmailSettings settings={settings} />
            )}

            {/* Credits & Referrals Tab */}
            {activeTab === 'credits' && (
              <CreditReferralSettings settings={settings} />
            )}

            {/* License Tab */}
            {activeTab === 'license' && (
              <LicenseSettings settings={settings} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
