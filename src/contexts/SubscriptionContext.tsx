import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export type PlanType = 'demo' | 'basic' | 'pro';

export interface Subscription {
  plan_type: PlanType;
  ai_addon: boolean;
  billing_cycle: 'monthly' | 'yearly' | null;
  is_active: boolean;
  expires_at: string | null;
}

export interface DemoUsage {
  bills_created: number;
  inventory_items: number;
  customers_added: number;
}

export interface DemoLimits {
  bills: { current: number; max: number };
  inventory: { current: number; max: number };
  customers: { current: number; max: number };
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  demoUsage: DemoUsage | null;
  isDemo: boolean;
  isPro: boolean;
  hasAI: boolean;
  loading: boolean;
  checkLimit: (limitType: 'bills' | 'inventory' | 'customers') => Promise<{ allowed: boolean; current: number; max: number }>;
  incrementUsage: (limitType: 'bills' | 'inventory' | 'customers', amount?: number) => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const DEMO_LIMITS = {
  bills: 5,
  inventory: 10,
  customers: 10
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [demoUsage, setDemoUsage] = useState<DemoUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch subscription
      const subRef = doc(db, 'user_subscriptions', user.uid);
      const subSnap = await getDoc(subRef);

      if (subSnap.exists()) {
        const subData = subSnap.data();
        setSubscription({
          plan_type: subData.plan_type as PlanType,
          ai_addon: subData.ai_addon,
          billing_cycle: subData.billing_cycle as 'monthly' | 'yearly' | null,
          is_active: subData.is_active,
          expires_at: subData.expires_at
        });
      } else {
        // Create default demo subscription
        await setDoc(subRef, {
          user_id: user.uid,
          plan_type: 'demo',
          ai_addon: false,
          billing_cycle: null,
          is_active: true,
          expires_at: null,
          created_at: new Date().toISOString()
        });

        setSubscription({
          plan_type: 'demo',
          ai_addon: false,
          billing_cycle: null,
          is_active: true,
          expires_at: null
        });
      }

      // Fetch demo usage
      const usageRef = doc(db, 'demo_usage', user.uid);
      const usageSnap = await getDoc(usageRef);

      if (usageSnap.exists()) {
        const usageData = usageSnap.data();
        setDemoUsage({
          bills_created: usageData.bills_created,
          inventory_items: usageData.inventory_items,
          customers_added: usageData.customers_added
        });
      } else {
        // Create default demo usage
        await setDoc(usageRef, {
          user_id: user.uid,
          bills_created: 0,
          inventory_items: 0,
          customers_added: 0,
          created_at: new Date().toISOString()
        });

        setDemoUsage({
          bills_created: 0,
          inventory_items: 0,
          customers_added: 0
        });
      }
    } catch (error) {
      console.error('Error in fetchSubscription:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(() => {
      fetchSubscription();
    });

    return () => unsubscribe();
  }, []);

  const isDemo = subscription?.plan_type === 'demo' || !subscription;
  const isPro = subscription?.plan_type === 'pro' && subscription?.is_active;
  const hasAI = subscription?.ai_addon || false;

  const checkLimit = async (limitType: 'bills' | 'inventory' | 'customers') => {
    if (!isDemo) {
      return { allowed: true, current: 0, max: Infinity };
    }

    const currentMap = {
      bills: demoUsage?.bills_created || 0,
      inventory: demoUsage?.inventory_items || 0,
      customers: demoUsage?.customers_added || 0
    };

    const current = currentMap[limitType];
    const max = DEMO_LIMITS[limitType];

    return {
      allowed: current < max,
      current,
      max
    };
  };

  const incrementUsage = async (limitType: 'bills' | 'inventory' | 'customers', amount: number = 1) => {
    // Optimistic Update
    const updateField = {
      bills: 'bills_created',
      inventory: 'inventory_items',
      customers: 'customers_added'
    }[limitType];

    setDemoUsage(prev => prev ? {
      ...prev,
      [updateField]: (prev[updateField as keyof DemoUsage] || 0) + amount
    } : null);

    const user = auth.currentUser;
    if (!user) return; // Should not happen if calling logic checks auth, but safe guard

    try {
      const usageRef = doc(db, 'demo_usage', user.uid);
      const usageSnap = await getDoc(usageRef);

      if (usageSnap.exists()) {
        const currentVal = usageSnap.data()[updateField] || 0;
        await updateDoc(usageRef, {
          [updateField]: currentVal + amount,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error("Failed to update usage stats", e);
      // Revert optimistic update? Or just let it sync next time.
      fetchSubscription();
    }
  };

  return (
    <SubscriptionContext.Provider value={{
      subscription,
      demoUsage,
      isDemo,
      isPro,
      hasAI,
      loading,
      checkLimit,
      incrementUsage,
      refreshSubscription: fetchSubscription
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
