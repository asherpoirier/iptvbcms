import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Shield, Clock, User, Key, Copy, Check, AlertTriangle, RefreshCw, Loader2, Tv, Mail } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function LauncherManagePage() {
  const { deviceToken } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [renewing, setRenewing] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const resp = await axios.get(`${API_URL}/api/launcher/manage-info/${deviceToken}`);
        setData(resp.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Unable to load account');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [deviceToken]);

  const copy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleRenew = (product) => {
    // Open checkout for this product via the launcher checkout flow
    setRenewing(product.product_id);
    window.location.href = `${API_URL}/launcher/pay/renew?product=${product.product_id}&token=${deviceToken}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full text-center border border-red-800">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Account Not Found</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const d = data;
  const isExpired = d.has_service && d.service_status === 'expired';
  const isExpiringSoon = d.has_service && d.days_remaining <= 7 && d.days_remaining > 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {d.branding?.logo_url ? (
              <img src={d.branding.logo_url} alt="" className="h-8" />
            ) : (
              <Tv className="w-7 h-7 text-blue-500" />
            )}
            <h1 className="text-xl font-bold">{d.branding?.company_name || 'My Account'}</h1>
          </div>
          {d.customer_name && (
            <span className="text-sm text-gray-400">{d.customer_name}</span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Service Status Card */}
        {d.has_service ? (
          <div className={`rounded-2xl border overflow-hidden ${
            isExpired ? 'border-red-800 bg-red-950/30' : isExpiringSoon ? 'border-yellow-800 bg-yellow-950/20' : 'border-green-800 bg-green-950/20'
          }`}>
            <div className={`px-6 py-4 ${
              isExpired ? 'bg-red-900/40' : isExpiringSoon ? 'bg-yellow-900/30' : 'bg-green-900/30'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className={`w-6 h-6 ${isExpired ? 'text-red-400' : isExpiringSoon ? 'text-yellow-400' : 'text-green-400'}`} />
                  <div>
                    <h2 className="font-bold text-lg">{d.product_name}</h2>
                    <p className={`text-sm ${isExpired ? 'text-red-300' : isExpiringSoon ? 'text-yellow-300' : 'text-green-300'}`}>
                      {isExpired ? 'Expired' : isExpiringSoon ? `Expiring in ${d.days_remaining} day${d.days_remaining !== 1 ? 's' : ''}` : `${d.days_remaining} days remaining`}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                  isExpired ? 'bg-red-500/20 text-red-300' : isExpiringSoon ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'
                }`}>
                  {d.service_status?.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CredentialRow label="Username" value={d.username} id="user" copied={copied} onCopy={copy} />
                <CredentialRow label="Password" value="••••••••" copyValue={d.username ? undefined : undefined} id="pass" copied={copied} onCopy={copy} hidden />
              </div>

              {d.streaming_url && (
                <CredentialRow label="Server URL" value={d.streaming_url} id="server" copied={copied} onCopy={copy} />
              )}

              {/* Info row */}
              <div className="flex items-center justify-between text-sm text-gray-400 pt-2 border-t border-gray-800">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    {d.connections} connection{d.connections !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {d.expires_at ? new Date(d.expires_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">No Active Service</h2>
            <p className="text-gray-400">Purchase a package below to get started.</p>
          </div>
        )}

        {/* Renewal / Purchase Options */}
        {d.renewal_products && d.renewal_products.length > 0 && (
          <div>
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-400" />
              {d.has_service ? (isExpired ? 'Renew Your Service' : 'Extend Your Service') : 'Available Packages'}
            </h3>
            <div className="grid gap-3">
              {d.renewal_products.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleRenew(p)}
                  disabled={renewing === p.product_id}
                  className="w-full flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-600 hover:bg-gray-800/80 transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  data-testid={`renew-${p.product_id}`}
                >
                  <div className="text-left">
                    <p className="font-semibold text-white">{p.name}</p>
                    <p className="text-sm text-gray-400">{p.term_months} month{p.term_months !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-xl font-bold text-blue-400">${p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Support */}
        {d.branding?.support_email && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-sm font-medium">Need help?</p>
                <p className="text-xs text-gray-400">Contact support</p>
              </div>
            </div>
            <a href={`mailto:${d.branding.support_email}`}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 border border-gray-700">
              {d.branding.support_email}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function CredentialRow({ label, value, copyValue, id, copied, onCopy, hidden }) {
  const displayValue = value || '—';
  const textToCopy = copyValue !== undefined ? copyValue : value;

  return (
    <div className="bg-gray-800/50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <code className="text-sm font-mono text-white truncate">{displayValue}</code>
        {textToCopy && (
          <button onClick={() => onCopy(textToCopy, id)} className="text-gray-500 hover:text-blue-400 shrink-0">
            {copied === id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
