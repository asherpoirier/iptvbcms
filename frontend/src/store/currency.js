import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export const useCurrencyStore = create(
  persist(
    (set, get) => ({
      // Global (admin-set) currency
      code: 'USD',
      symbol: '$',
      baseCurrency: 'USD',
      // Customer's display preference
      displayCode: null, // null = use global
      displaySymbol: null,
      // Available currencies with rates
      available: [],
      rates: {},

      fetchCurrency: async () => {
        try {
          const response = await axios.get(`${API_URL}/api/currency`);
          const data = response.data;
          const rates = {};
          (data.available || []).forEach(c => { rates[c.code] = c.rate; });

          const state = get();
          const display = state.displayCode;
          // If customer has a preference, use it; otherwise use global
          const activeCode = display && rates[display] ? display : data.code;
          const activeSymbol = display && rates[display]
            ? (data.available || []).find(c => c.code === display)?.symbol || '$'
            : data.symbol;

          set({
            code: activeCode,
            symbol: activeSymbol,
            baseCurrency: data.code,
            available: data.available || [],
            rates,
          });
        } catch {
          // keep defaults
        }
      },

      setDisplayCurrency: (currencyCode) => {
        const state = get();
        const cur = state.available.find(c => c.code === currencyCode);
        if (cur) {
          set({
            displayCode: currencyCode,
            displaySymbol: cur.symbol,
            code: currencyCode,
            symbol: cur.symbol,
          });
        }
      },

      // Convert a price from the base (global) currency to the display currency
      convertPrice: (price) => {
        const state = get();
        const amount = parseFloat(price) || 0;
        if (amount === 0) return 0;
        const baseRate = state.rates[state.baseCurrency] || 1;
        const displayRate = state.rates[state.code] || 1;
        // Convert: price_in_base / baseRate * displayRate
        return Math.round((amount / baseRate) * displayRate * 100) / 100;
      },

      // Format a price with the current display currency symbol
      formatPrice: (price) => {
        const state = get();
        const converted = state.convertPrice(parseFloat(price) || 0);
        if (converted === 0) return 'FREE';
        return `${state.symbol}${converted.toFixed(2)}`;
      },
    }),
    {
      name: 'currency-preference',
      partialize: (state) => ({ displayCode: state.displayCode, displaySymbol: state.displaySymbol }),
    }
  )
);
