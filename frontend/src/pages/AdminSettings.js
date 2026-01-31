import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft } from 'lucide-react';
import BrandingSettings from '../components/BrandingSettings';
import PanelManagement from '../components/PanelManagement';
import XuiOnePanelManagement from '../components/XuiOnePanelManagement';
import PaymentGatewaySettings from '../components/PaymentGatewaySettings';
import EmailSettings from '../components/EmailSettings';
import CreditReferralSettings from '../components/CreditReferralSettings';
import LicenseSettings from '../components/LicenseSettings';
import UpdateManager from '../components/UpdateManager';
import NotificationSettings from '../components/NotificationSettings';

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
                onClick={() => setActiveTab('smtp')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'smtp' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Email (SMTP)
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

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <NotificationSettings settings={settings} />
            )}

            {/* License Tab */}
            {activeTab === 'license' && (
              <LicenseSettings settings={settings} />
            )}
            
            {/* Updates Tab */}
            {activeTab === 'updates' && (
              <UpdateManager />
            )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
