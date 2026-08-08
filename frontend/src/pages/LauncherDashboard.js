import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/api';
import { ArrowLeft, Smartphone, DollarSign, Activity, Users, Clock, TrendingUp } from 'lucide-react';

export default function LauncherDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['launcher-analytics'],
    queryFn: async () => {
      const resp = await api.get('/api/launcher/admin/analytics');
      return resp.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const stats = data || {};
  const monthly = (stats.monthly_revenue || []).reverse();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-blue-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-teal-600" />
              Launcher Analytics
            </h1>
          </div>
          <Link to="/admin/settings" className="text-sm text-blue-600 hover:underline">Manage API Keys</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={Smartphone} label="Total Devices" value={stats.total_devices || 0} color="teal" />
          <StatCard icon={Activity} label="Active Devices" value={stats.active_devices || 0} color="green" />
          <StatCard icon={Clock} label="Active (24h)" value={stats.recently_active_24h || 0} color="blue" />
          <StatCard icon={DollarSign} label="Revenue" value={`$${(stats.total_revenue || 0).toFixed(2)}`} color="emerald" />
          <StatCard icon={TrendingUp} label="Total Orders" value={stats.total_orders || 0} color="purple" />
        </div>

        {/* Monthly Revenue Chart (simple bars) */}
        {monthly.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Monthly Revenue</h2>
            <div className="flex items-end gap-3 h-40">
              {monthly.map((m) => {
                const maxRev = Math.max(...monthly.map(x => x.revenue), 1);
                const height = Math.max(8, (m.revenue / maxRev) * 100);
                return (
                  <div key={m._id} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">${m.revenue.toFixed(0)}</span>
                    <div className="w-full bg-teal-500 rounded-t-lg" style={{ height: `${height}%` }} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{m._id}</span>
                    <span className="text-xs text-gray-400">{m.orders} orders</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Devices Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600" />
              Active Devices ({stats.devices?.length || 0})
            </h2>
          </div>
          {stats.devices?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Package</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {stats.devices.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">{d.device_id?.slice(0, 12)}...</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{d.username || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{d.service_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          d.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>{d.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {d.expiry ? new Date(d.expiry).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {d.last_seen ? timeAgo(new Date(d.last_seen)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No launcher devices registered yet. Devices appear after completing their first purchase.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600',
  };
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
