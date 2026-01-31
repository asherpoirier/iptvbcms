import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/api';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

const CreditBalance = ({ showHistory = false }) => {
  const { data: balance } = useQuery({
    queryKey: ['credit-balance'],
    queryFn: async () => {
      const response = await api.get('/api/credits/balance');
      return response.data;
    },
    refetchInterval: 30000,
  });

  const { data: history } = useQuery({
    queryKey: ['credit-history'],
    queryFn: async () => {
      const response = await api.get('/api/credits/history');
      return response.data;
    },
    enabled: showHistory,
  });

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 text-sm mb-1">Available Credits</p>
            <p className="text-4xl font-bold">${balance?.balance?.toFixed(2) || '0.00'}</p>
          </div>
          <Wallet className="w-16 h-16 text-green-200 opacity-50" />
        </div>
        <p className="text-green-100 text-sm mt-4">
          Use credits to pay for your next order or service renewal
        </p>
      </div>

      {showHistory && history && history.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Credit History</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {history.map((txn) => (
              <div key={txn.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center gap-3">
                  {txn.amount > 0 ? (
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{txn.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(txn.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    txn.amount > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {txn.amount > 0 ? '+' : ''}${Math.abs(txn.amount).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Balance: ${txn.balance_after.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditBalance;
