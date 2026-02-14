import React from 'react';
import { useCurrencyStore } from '../store/currency';

export default function CurrencySwitcher() {
  const { code, available, setDisplayCurrency } = useCurrencyStore();

  if (!available || available.length <= 1) return null;

  return (
    <select
      value={code}
      onChange={(e) => setDisplayCurrency(e.target.value)}
      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer"
      data-testid="currency-switcher"
    >
      {available.map((c) => (
        <option key={c.code} value={c.code}>
          {c.symbol} {c.code}
        </option>
      ))}
    </select>
  );
}
