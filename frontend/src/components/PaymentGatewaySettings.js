import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Save, CreditCard, DollarSign, Bitcoin, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';

export default function PaymentGatewaySettings({ settings }) {
  const queryClient = useQueryClient();
  
  // Default payment method order
  const defaultOrder = ['manual', 'stripe', 'paypal', 'square', 'blockonomics'];
  
  const [formData, setFormData] = useState({
    paypal_enabled: settings?.paypal?.enabled || false,
    paypal_client_id: settings?.paypal?.client_id || '',
    paypal_secret: settings?.paypal?.secret || '',
    paypal_mode: settings?.paypal?.mode || 'sandbox',
    stripe_enabled: settings?.stripe?.enabled || false,
    stripe_mode: settings?.stripe?.mode || 'test',
    stripe_publishable_key: settings?.stripe?.publishable_key || '',
    stripe_secret_key: settings?.stripe?.secret_key || '',
    stripe_crypto_enabled: settings?.stripe?.crypto_enabled !== false,
    square_enabled: settings?.square?.enabled || false,
    square_access_token: settings?.square?.access_token || '',
    square_application_id: settings?.square?.application_id || '',
    square_location_id: settings?.square?.location_id || '',
    square_environment: settings?.square?.environment || 'sandbox',
    blockonomics_enabled: settings?.blockonomics?.enabled || false,
    blockonomics_api_key: settings?.blockonomics?.api_key || '',
    blockonomics_confirmations: settings?.blockonomics?.confirmations_required || 1,
    payment_method_order: settings?.payment_method_order || defaultOrder,
  });

  React.useEffect(() => {
    if (settings) {
      setFormData({
        paypal_enabled: settings?.paypal?.enabled || false,
        paypal_client_id: settings?.paypal?.client_id || '',
        paypal_secret: settings?.paypal?.secret || '',
        paypal_mode: settings?.paypal?.mode || 'sandbox',
        stripe_enabled: settings?.stripe?.enabled || false,
        stripe_mode: settings?.stripe?.mode || 'test',
        stripe_publishable_key: settings?.stripe?.publishable_key || '',
        stripe_secret_key: settings?.stripe?.secret_key || '',
        stripe_crypto_enabled: settings?.stripe?.crypto_enabled !== false,
        square_enabled: settings?.square?.enabled || false,
        square_access_token: settings?.square?.access_token || '',
        square_application_id: settings?.square?.application_id || '',
        square_location_id: settings?.square?.location_id || '',
        square_environment: settings?.square?.environment || 'sandbox',
        blockonomics_enabled: settings?.blockonomics?.enabled || false,
        blockonomics_api_key: settings?.blockonomics?.api_key || '',
        blockonomics_confirmations: settings?.blockonomics?.confirmations_required || 1,
        payment_method_order: settings?.payment_method_order || defaultOrder,
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data) => {
      const settingsUpdate = {
        ...settings,
        paypal: {
          enabled: data.paypal_enabled,
          client_id: data.paypal_client_id,
          secret: data.paypal_secret,
          mode: data.paypal_mode
        },
        stripe: {
          enabled: data.stripe_enabled,
          mode: data.stripe_mode,
          publishable_key: data.stripe_publishable_key,
          secret_key: data.stripe_secret_key,
          crypto_enabled: data.stripe_crypto_enabled
        },
        square: {
          enabled: data.square_enabled,
          access_token: data.square_access_token,
          application_id: data.square_application_id,
          location_id: data.square_location_id,
          environment: data.square_environment
        },
        blockonomics: {
          enabled: data.blockonomics_enabled,
          api_key: data.blockonomics_api_key,
          confirmations_required: data.blockonomics_confirmations
        },
        payment_method_order: data.payment_method_order
      };
      return adminAPI.updateSettings(settingsUpdate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-settings']);
      alert('Payment gateway settings saved!');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  // Move payment method up/down
  const movePaymentMethod = (method, direction) => {
    const order = [...formData.payment_method_order];
    const currentIndex = order.indexOf(method);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= order.length) return;
    
    [order[currentIndex], order[newIndex]] = [order[newIndex], order[currentIndex]];
    setFormData({ ...formData, payment_method_order: order });
  };

  const paymentMethodLabels = {
    manual: { name: 'Manual Payment', icon: DollarSign, color: 'text-green-600' },
    stripe: { name: 'Stripe', icon: CreditCard, color: 'text-purple-600' },
    paypal: { name: 'PayPal', icon: CreditCard, color: 'text-blue-600' },
    square: { name: 'Square', icon: CreditCard, color: 'text-indigo-600' },
    blockonomics: { name: 'Bitcoin (Blockonomics)', icon: Bitcoin, color: 'text-orange-500' },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-600" />
          Payment Gateways
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Configure payment methods available to customers
        </p>
      </div>

      {/* Payment Method Order Section */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <GripVertical className="w-5 h-5" />
          Payment Method Display Order
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Arrange the order payment methods appear at checkout
        </p>
        <div className="space-y-2">
          {formData.payment_method_order.map((method, index) => {
            const methodInfo = paymentMethodLabels[method];
            if (!methodInfo) return null;
            const IconComponent = methodInfo.icon;
            return (
              <div 
                key={method}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 font-mono text-sm w-6">{index + 1}.</span>
                  <IconComponent className={`w-5 h-5 ${methodInfo.color}`} />
                  <span className="font-medium text-gray-900 dark:text-white">{methodInfo.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => movePaymentMethod(method, 'up')}
                    disabled={index === 0}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowUp className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePaymentMethod(method, 'down')}
                    disabled={index === formData.payment_method_order.length - 1}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowDown className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual Payment */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-green-600" />
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Manual Payment</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Admin confirms payments manually</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold rounded-full">
            Always Active
          </span>
        </div>
      </div>

      {/* Stripe */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-purple-600" />
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Stripe</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Accept cards, crypto (Bitcoin, USDC, ETH)</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.stripe_enabled}
              onChange={(e) => setFormData({ ...formData, stripe_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
        
        {formData.stripe_enabled && (
          <div className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mode</label>
              <select
                value={formData.stripe_mode}
                onChange={(e) => setFormData({ ...formData, stripe_mode: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="test">Test Mode</option>
                <option value="live">Live (Production)</option>
              </select>
            </div>
            
            {formData.stripe_mode === 'live' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Publishable Key (pk_live_...) *
                  </label>
                  <input
                    type="text"
                    value={formData.stripe_publishable_key}
                    onChange={(e) => setFormData({ ...formData, stripe_publishable_key: e.target.value })}
                    placeholder="pk_live_..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Secret Key (sk_live_...) *
                  </label>
                  <input
                    type="password"
                    value={formData.stripe_secret_key}
                    onChange={(e) => setFormData({ ...formData, stripe_secret_key: e.target.value })}
                    placeholder="sk_live_..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ <strong>Production Mode:</strong> Using your own Stripe keys. Ensure your Stripe account has crypto payments enabled if you want to accept Bitcoin/USDC.
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  ℹ <strong>Test Mode:</strong> Using Stripe sandbox environment for testing. Use test card: 4242 4242 4242 4242
                </p>
              </div>
            )}
            
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Stripe Test Cards</h4>
              <div className="space-y-2 text-sm">
                <p className="text-gray-700 dark:text-gray-300"><code className="bg-white dark:bg-gray-900 px-2 py-1 rounded">4242 4242 4242 4242</code> - Visa (Success)</p>
                <p className="text-gray-700 dark:text-gray-300"><code className="bg-white dark:bg-gray-900 px-2 py-1 rounded">4000 0025 0000 3155</code> - Visa (3D Secure)</p>
                <p className="text-gray-700 dark:text-gray-300"><code className="bg-white dark:bg-gray-900 px-2 py-1 rounded">4000 0000 0000 9995</code> - Visa (Declined)</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Use any future expiry date and any 3-digit CVC</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Remove crypto toggle for standard Stripe */}

      {/* PayPal */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#003087">
              <path d="M20.905 9.5c.21-1.342.097-2.254-.415-3.15-.565-1.008-1.79-1.852-3.499-2.209C15.797 3.89 14.437 3.75 12.768 3.75H6.917c-.563 0-1.043.408-1.13.963L3.045 19.287c-.066.423.246.713.638.713h4.637l-.32 2.025c-.058.37.214.623.558.623h3.898c.492 0 .91-.356.988-.84l.041-.211.777-4.926.05-.272c.078-.484.496-.84.988-.84h.622c3.245 0 5.784-1.317 6.525-5.128.31-1.592.149-2.922-.643-3.859z"/>
            </svg>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">PayPal</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Accept payments via PayPal</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.paypal_enabled}
              onChange={(e) => setFormData({ ...formData, paypal_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {formData.paypal_enabled && (
          <div className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mode</label>
              <select
                value={formData.paypal_mode}
                onChange={(e) => setFormData({ ...formData, paypal_mode: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="sandbox">Sandbox (Testing)</option>
                <option value="live">Live (Production)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Client ID *</label>
              <input
                type="text"
                value={formData.paypal_client_id}
                onChange={(e) => setFormData({ ...formData, paypal_client_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Secret *</label>
              <input
                type="password"
                value={formData.paypal_secret}
                onChange={(e) => setFormData({ ...formData, paypal_secret: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Square */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-indigo-600" />
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Square</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Accept cards, Apple Pay, Google Pay</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.square_enabled}
              onChange={(e) => setFormData({ ...formData, square_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {formData.square_enabled && (
          <div className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Environment</label>
              <select
                value={formData.square_environment}
                onChange={(e) => setFormData({ ...formData, square_environment: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="sandbox">Sandbox (Testing)</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Access Token *</label>
              <input
                type="password"
                value={formData.square_access_token}
                onChange={(e) => setFormData({ ...formData, square_access_token: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Application ID *</label>
              <input
                type="text"
                value={formData.square_application_id}
                onChange={(e) => setFormData({ ...formData, square_application_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location ID *</label>
              <input
                type="text"
                value={formData.square_location_id}
                onChange={(e) => setFormData({ ...formData, square_location_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Blockonomics (Bitcoin) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bitcoin className="w-6 h-6 text-orange-500" />
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Blockonomics (Bitcoin)</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Accept Bitcoin payments directly to your wallet</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.blockonomics_enabled}
              onChange={(e) => setFormData({ ...formData, blockonomics_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        </div>

        {formData.blockonomics_enabled && (
          <div className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API Key *</label>
              <input
                type="password"
                value={formData.blockonomics_api_key}
                onChange={(e) => setFormData({ ...formData, blockonomics_api_key: e.target.value })}
                placeholder="Your Blockonomics API Key"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Get your API key from <a href="https://www.blockonomics.co/merchants" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Blockonomics Merchant Dashboard</a>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirmations Required</label>
              <select
                value={formData.blockonomics_confirmations}
                onChange={(e) => setFormData({ ...formData, blockonomics_confirmations: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="1">1 Confirmation (~10 min) - Faster</option>
                <option value="2">2 Confirmations (~20 min) - Recommended</option>
                <option value="3">3 Confirmations (~30 min) - Most Secure</option>
              </select>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4 space-y-3">
              <p className="text-sm text-orange-800 dark:text-orange-200 font-semibold">
                ⚠️ Required Setup in Blockonomics Dashboard:
              </p>
              <ol className="text-sm text-orange-800 dark:text-orange-200 list-decimal list-inside space-y-1">
                <li>Go to <a href="https://www.blockonomics.co/merchants" target="_blank" rel="noopener noreferrer" className="underline">Blockonomics Merchants</a></li>
                <li>Click "Add new store" if you haven't already</li>
                <li>Add your Bitcoin wallet xPub/address</li>
                <li>Set the <strong>HTTP Callback URL</strong> to:<br/>
                  <code className="bg-orange-100 dark:bg-orange-800 px-2 py-1 rounded text-xs block mt-1 break-all">
                    {window.location.origin.replace(':3000', ':8001')}/api/webhooks/blockonomics
                  </code>
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>

      <div className="pt-6">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
        >
          <Save className="w-5 h-5" />
          {updateMutation.isPending ? 'Saving...' : 'Save Payment Settings'}
        </button>
      </div>
    </form>
  );
}
