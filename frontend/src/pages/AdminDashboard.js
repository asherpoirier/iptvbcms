import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { useAuthStore } from '../store/store';
import { Server, Users, ShoppingBag, DollarSign, Settings, LogOut, Package, MessageSquare, Mail, FileText, Tag, RefreshCw, Download, Key } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await adminAPI.getStats();
      return response.data;
    },
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Server className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">IPTV Billing System</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-700 dark:text-gray-200">Admin: {user?.name}</span>
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
        {/* Stats Grid */}
        {isLoading ? (
          <div className="text-center py-12 dark:text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Customers</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total_customers || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">${stats?.total_revenue?.toFixed(2) || '0.00'}</p>
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
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.pending_orders || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Server className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Active Services</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.active_services || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Link
                to="/admin/customers"
                className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
              >
                <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Customers</h3>
                <p className="text-sm text-gray-600 mt-1">Manage customers</p>
              </Link>

              <Link
                to="/admin/orders"
                className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
              >
                <ShoppingBag className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Orders</h3>
                <p className="text-sm text-gray-600 mt-1">Process orders</p>
              </Link>

              <Link
                to="/admin/products"
                className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
              >
                <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Products</h3>
                <p className="text-sm text-gray-600 mt-1">Manage products</p>
              </Link>

              <Link
                to="/admin/settings"
                className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
              >
                <Settings className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Settings</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Configure system</p>
              </Link>

              <Link
                to="/admin/tickets"
                className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
              >
                <MessageSquare className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Tickets</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Support tickets</p>
              </Link>

              <Link
                to="/admin/mass-email"
                className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
                data-testid="mass-email-link"
              >
                <Mail className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Mass Email</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Send customer emails</p>
              </Link>

              <Link
                to="/admin/email-templates"
                className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
                data-testid="email-templates-link"
              >
                <FileText className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Email Templates</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Customize email templates</p>
              </Link>

              <Link
                to="/admin/coupons"
                className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
                data-testid="coupons-link"
              >
                <Tag className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Coupons</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage discount codes</p>
              </Link>

              <Link
                to="/admin/refunds"
                className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
                data-testid="refunds-link"
              >
                <RefreshCw className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Refunds</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Approve refund requests</p>
              </Link>

              <Link
                to="/admin/downloads"
                className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
                data-testid="downloads-link"
              >
                <Download className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Downloads</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage client files</p>
              </Link>

              <Link
                to="/admin/licenses"
                className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition text-center"
                data-testid="licenses-link"
              >
                <Key className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Licenses</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage license keys</p>
              </Link>
            </div>

            {/* Recent Orders */}
            {stats?.recent_orders && stats.recent_orders.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Orders</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Order ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {stats.recent_orders.slice(0, 5).map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                            #{order.id.substring(0, 8)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {order.customer_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                            ${order.total.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              order.status === 'paid' 
                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                            {new Date(order.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                  <Link to="/admin/orders" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold text-sm">
                    View all orders →
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
