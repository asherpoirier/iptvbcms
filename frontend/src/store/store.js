import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      isAdmin: () => get().user?.role === 'admin',
    }),
    {
      name: 'auth-storage',
    }
  )
);

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      // Add item with optional renewal info
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
      // Add item specifically for renewal/extension
      addRenewalItem: (item, serviceId, actionType = 'extend') => set((state) => ({ 
        items: [...state.items, { 
          ...item, 
          renewal_service_id: serviceId,
          action_type: actionType  // 'extend' or 'create_new'
        }] 
      })),
      // Update action type for an item
      updateItemAction: (product_id, term_months, actionType, serviceId = null) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.product_id === product_id && item.term_months === term_months
              ? { ...item, action_type: actionType, renewal_service_id: serviceId }
              : item
          ),
        })),
      removeItem: (product_id, term_months) =>
        set((state) => ({
          items: state.items.filter(
            (item) => !(item.product_id === product_id && item.term_months === term_months)
          ),
        })),
      clearCart: () => set({ items: [] }),
      getTotal: () => get().items.reduce((sum, item) => sum + item.price, 0),
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items })  // Explicitly persist items array with all fields
    }
  )
);
