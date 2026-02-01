import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { servicesAPI, ordersAPI } from '../api/api';
import { useAuthStore } from '../store/store';
import { useBrandingStore } from '../store/branding';
import { Server, ShoppingBag, FileText, LogOut, User, Tv, MessageSquare, Gift, Wallet, Download } from 'lucide-react';
import CreditBalance from '../components/CreditBalance';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { branding } = useBrandingStore();

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await servicesAPI.getAll();
      return response.data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const response = await ordersAPI.getAll();
      return response.data;
    },
  });

  const { data: referralSettings } = useQuery({
    queryKey: ['my-referral-quick'],
    queryFn: async () => {
      const response = await api.get('/api/referral/my-code');
      return response.data;
    },
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const activeServices = services?.filter((s) => s.status === 'active') || [];
  const pendingOrders = orders?.filter((o) => o.status === 'pending') || [];
  const referrerReward = referralSettings?.settings?.referrer_reward || 10;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={branding.site_name} className="h-8" />
              ) : (
                <Server className="w-8 h-8" style={{ color: branding.primary_color }} />
              )}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{branding.site_name}</h1>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-gray-700 dark:text-gray-200">Welcome, {user?.name}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-600 hover:text-red-600"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Tv className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Services</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeServices.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending Orders</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingOrders.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{orders?.length || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link
            to="/services"
            className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
          >
            <Tv className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">My Services</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">View credentials</p>
          </Link>

          <Link
            to="/orders"
            className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
          >
            <ShoppingBag className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Orders</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Order history</p>
          </Link>

          <Link
            to="/invoices"
            className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
          >
            <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Invoices</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Download PDFs</p>
          </Link>

          <Link
            to="/tickets"
            className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
          >
            <MessageSquare className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Support</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Get help</p>
          </Link>

          <Link
            to="/downloads"
            className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
            data-testid="downloads-link"
          >
            <Download className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Downloads</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Client apps & guides</p>
          </Link>

          <Link
            to="/referrals"
            className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
            data-testid="referral-link"
          >
            <Gift className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Refer & Earn</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Get ${referrerReward} credits</p>
          </Link>
        </div>

        {/* Credit Balance Widget */}
        <div className="mb-8">
          <CreditBalance showHistory={false} />
        </div>

        {/* Recent Services */}
        {activeServices.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Active Services</h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {activeServices.slice(0, 3).map((service) => (
                <div key={service.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{service.product_name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        Expires: {new Date(service.expiry_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm rounded-full">
                      Active
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800">
              <Link to="/services" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold text-sm">
                View all services →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
