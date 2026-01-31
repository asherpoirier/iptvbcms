import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Save, DollarSign, Gift } from 'lucide-react';

export default function CreditReferralSettings({ settings }) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    credit_enabled: settings?.credit?.enabled ?? true,
    credit_allow_negative: settings?.credit?.allow_negative_balance ?? false,
    credit_minimum: settings?.credit?.minimum_balance ?? 0,
    credit_maximum: settings?.credit?.maximum_balance ?? 10000,
    referral_enabled: settings?.referral?.enabled ?? true,
    referral_referrer_reward: settings?.referral?.referrer_reward ?? 10.0,
    referral_referred_reward: settings?.referral?.referred_reward ?? 5.0,
    referral_minimum_purchase: settings?.referral?.minimum_purchase ?? 0.0,
    referral_expiry_days: settings?.referral?.expiry_days ?? 90,
  });

  React.useEffect(() => {
    if (settings) {
      setFormData({
        credit_enabled: settings?.credit?.enabled ?? true,
        credit_allow_negative: settings?.credit?.allow_negative_balance ?? false,
        credit_minimum: settings?.credit?.minimum_balance ?? 0,
        credit_maximum: settings?.credit?.maximum_balance ?? 10000,
        referral_enabled: settings?.referral?.enabled ?? true,
        referral_referrer_reward: settings?.referral?.referrer_reward ?? 10.0,
        referral_referred_reward: settings?.referral?.referred_reward ?? 5.0,
        referral_minimum_purchase: settings?.referral?.minimum_purchase ?? 0.0,
        referral_expiry_days: settings?.referral?.expiry_days ?? 90,
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data) => {
      const settingsUpdate = {
        ...settings,
        credit: {
          enabled: data.credit_enabled,
          allow_negative_balance: data.credit_allow_negative,
          minimum_balance: parseFloat(data.credit_minimum),
          maximum_balance: parseFloat(data.credit_maximum)
        },
        referral: {
          enabled: data.referral_enabled,
          referrer_reward: parseFloat(data.referral_referrer_reward),
          referred_reward: parseFloat(data.referral_referred_reward),
          minimum_purchase: parseFloat(data.referral_minimum_purchase),
          reward_type: "credit",
          expiry_days: parseInt(data.referral_expiry_days)
        }
      };
      return adminAPI.updateSettings(settingsUpdate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-settings']);
      alert('Settings saved successfully!');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Credit System Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-6 h-6 text-green-600" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Credit System</h3>
        </div>
        
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.credit_enabled}
              onChange={(e) => setFormData({...formData, credit_enabled: e.target.checked})}
              className="w-5 h-5 text-blue-600 rounded"
              data-testid="credit-enabled-toggle"
            />
            <span className="font-medium text-gray-900 dark:text-white">Enable Credit System</span>
          </label>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimum Balance ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.credit_minimum}
                onChange={(e) => setFormData({...formData, credit_minimum: e.target.value})}
                disabled={!formData.credit_enabled}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maximum Balance ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.credit_maximum}
                onChange={(e) => setFormData({...formData, credit_maximum: e.target.value})}
                disabled={!formData.credit_enabled}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Referral System Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-6 h-6 text-purple-600" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Referral Program</h3>
        </div>
        
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.referral_enabled}
              onChange={(e) => setFormData({...formData, referral_enabled: e.target.checked})}
              className="w-5 h-5 text-blue-600 rounded"
              data-testid="referral-enabled-toggle"
            />
            <span className="font-medium text-gray-900 dark:text-white">Enable Referral Program</span>
          </label>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Referrer Reward ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.referral_referrer_reward}
                onChange={(e) => setFormData({...formData, referral_referrer_reward: e.target.value})}
                disabled={!formData.referral_enabled}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                data-testid="referrer-reward-input"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Credits awarded to referrer on successful referral
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Referred User Reward ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.referral_referred_reward}
                onChange={(e) => setFormData({...formData, referral_referred_reward: e.target.value})}
                disabled={!formData.referral_enabled}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                data-testid="referred-reward-input"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Welcome bonus for new users who sign up with referral code
              </p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimum Purchase for Referral ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.referral_minimum_purchase}
                onChange={(e) => setFormData({...formData, referral_minimum_purchase: e.target.value})}
                disabled={!formData.referral_enabled}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Minimum order value for referral to complete
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Referral Link Expiry (days)
              </label>
              <input
                type="number"
                min="1"
                value={formData.referral_expiry_days}
                onChange={(e) => setFormData({...formData, referral_expiry_days: e.target.value})}
                disabled={!formData.referral_enabled}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                How long referral links remain valid
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="submit"
          disabled={updateMutation.isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          data-testid="save-credit-referral-settings"
        >
          <Save className="w-5 h-5" />
          {updateMutation.isLoading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
