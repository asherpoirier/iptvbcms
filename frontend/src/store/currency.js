import { create } from 'zustand';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export const useCurrencyStore = create((set) => ({
  code: 'USD',
  symbol: '$',
  fetchCurrency: async () => {
    try {
      const response = await axios.get(`${API_URL}/api/currency`);
      set({ code: response.data.code, symbol: response.data.symbol });
    } catch {
      // keep defaults
    }
  },
}));
