import { create } from 'zustand';
import type { User, InventoryItem, Customer, Invoice, DailySummary } from '@/types';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface AppState {
  // User state
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;

  // UI state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Dashboard data
  dailySummary: DailySummary | null;
  setDailySummary: (summary: DailySummary | null) => void;

  // Inventory
  inventory: InventoryItem[];
  setInventory: (items: InventoryItem[]) => void;

  // Customers
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;

  // Recent invoices
  recentInvoices: Invoice[];
  setRecentInvoices: (invoices: Invoice[]) => void;

  // Permissions
  permissions: string[];
  setPermissions: (permissions: string[]) => void;
  hasPermission: (module: string) => boolean;

  // AI Assistant state
  isAIOpen: boolean;
  setIsAIOpen: (open: boolean) => void;

  // Settings
  shopSettings: {
    shopName: string;
    gstin: string;
    address: string;
    state: string;
    phone: string;
    invoicePrefix: string;
    autoWhatsApp: boolean;
  };
  setShopSettings: (settings: Partial<AppState['shopSettings']>) => void;
  loadUserSettings: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  dailySummary: null,
  setDailySummary: (summary) => set({ dailySummary: summary }),

  inventory: [],
  setInventory: (items) => set({ inventory: items }),

  customers: [],
  setCustomers: (customers) => set({ customers }),

  recentInvoices: [],
  setRecentInvoices: (invoices) => set({ recentInvoices: invoices }),

  permissions: [],
  setPermissions: (permissions) => set({ permissions }),
  hasPermission: (module) => {
    const { currentUser, permissions } = get();
    // Safety check for permissions array
    if (!Array.isArray(permissions)) {
      console.warn('Permissions state is not an array:', permissions);
      return false;
    }

    // If owner (currentUser is set) or no permissions set (default), allow all
    // BUT for staff, currentUser is null, so we rely on permissions array.
    const isStaff = !!localStorage.getItem('revonn-staff-session');
    if (!isStaff) return true; // Owner has all permissions
    return permissions.includes(module) || permissions.includes('all');
  },

  isAIOpen: false,
  setIsAIOpen: (open) => set({ isAIOpen: open }),

  shopSettings: {
    shopName: 'My Shop',
    gstin: '',
    address: '',
    state: '',
    phone: '',
    invoicePrefix: 'INV',
    autoWhatsApp: false
  },
  setShopSettings: (settings) => set((state) => ({
    shopSettings: { ...state.shopSettings, ...settings }
  })),

  loadUserSettings: async () => {
    try {
      let userId: string | undefined;
      let userMeta: any = {};

      // Check for staff session first
      const staffSessionStr = localStorage.getItem('revonn-staff-session');
      if (staffSessionStr) {
        const staffSession = JSON.parse(staffSessionStr);

        // Handle permissions (can be array or object)
        let parsedPermissions: string[] = [];
        const rawPerms = staffSession.permissions;
        if (Array.isArray(rawPerms)) {
          parsedPermissions = rawPerms;
        } else if (typeof rawPerms === 'object' && rawPerms !== null) {
          parsedPermissions = Object.keys(rawPerms).filter(key => rawPerms[key] === true);
        }

        set((state) => ({
          permissions: parsedPermissions,
          shopSettings: {
            ...state.shopSettings,
            shopName: staffSession.shopName || 'My Shop',
            gstin: staffSession.gstin || '',
            address: staffSession.address || '',
            phone: staffSession.phone || '',
            state: staffSession.state || '',
          }
        }));
        return;
      }

      // Fallback to owner login
      const user = auth.currentUser;
      if (!user) return;

      userId = user.uid;

      // Try to get profile from users collection
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      const profile = docSnap.exists() ? docSnap.data() : null;

      set((state) => ({
        permissions: [], // Owner has all permissions, cleared here
        shopSettings: {
          ...state.shopSettings,
          shopName: profile?.shop_name || 'My Shop',
          gstin: profile?.gstin || '',
          address: profile?.address || '',
          phone: profile?.phone || '',
          state: profile?.state || '',
        }
      }));
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  }
}));