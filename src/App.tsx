import { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { auth } from '@/lib/firebase';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from "@/contexts/ThemeContext"
import { MainLayout } from '@/components/layout/MainLayout';
import Home from "./pages/Home";
import Splash from "./pages/Splash";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import InventoryDetail from "./pages/InventoryDetail";
import BOMUpload from "./pages/BOMUpload";
import Customers from "./pages/Customers";
import CustomerAdd from "./pages/CustomerAdd";
import CustomerDetail from "./pages/CustomerDetail";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import SettingsShop from "./pages/SettingsShop";
import SettingsAI from "./pages/SettingsAI";
import SettingsInvoice from "./pages/SettingsInvoice";
import SettingsNotifications from "./pages/SettingsNotifications";
import SettingsSync from "./pages/SettingsSync";
import SettingsPrivacy from "./pages/SettingsPrivacy";
import SettingsPricing from "./pages/SettingsPricing";
import Checkout from "./pages/Checkout";
import PolicyTerms from "./pages/PolicyTerms";
import PolicyRefund from "./pages/PolicyRefund";
import PolicyPrivacy from "./pages/PolicyPrivacy";
import Help from "./pages/Help";
import Billing from "./pages/Billing";
import InvoiceDetail from "./pages/InvoiceDetail";
import Staff from "./pages/Staff";
import Marketing from "./pages/Marketing";
import SubscriptionPlans from "./pages/SubscriptionPlans";
import PaymentStatus from "./pages/PaymentStatus";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Check if this is the first app load in this session
const isFirstLoad = !sessionStorage.getItem('app_loaded');
if (isFirstLoad) {
  sessionStorage.setItem('app_loaded', 'true');
}

function AppContent() {
  const [showSplash, setShowSplash] = useState(isFirstLoad);
  const [isCheckingAuth, setIsCheckingAuth] = useState(!isFirstLoad);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isFirstLoad) {
      // Check auth immediately for non-first loads
      checkAuth();
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      const staffSession = localStorage.getItem('revonn-staff-session');
      const nextAuth = !!user || !!staffSession;
      setIsAuthenticated(prev => prev === nextAuth ? prev : nextAuth);
      setIsCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [isFirstLoad]);

  const checkAuth = async () => {
    try {
      const user = auth.currentUser;
      const staffSession = localStorage.getItem('revonn-staff-session');
      setIsAuthenticated(!!user || !!staffSession);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleSplashComplete = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
    setShowSplash(false);
  };

  // Show splash only on first app load
  if (showSplash) {
    return <Splash onComplete={handleSplashComplete} />;
  }

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route element={isAuthenticated ? <MainLayout /> : <Navigate to="/auth" replace />}>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/:id" element={<InventoryDetail />} />
        <Route path="/inventory/upload" element={<BOMUpload />} />
        <Route path="/inventory/add" element={<BOMUpload />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/add" element={<CustomerAdd />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/shop" element={<SettingsShop />} />
        <Route path="/settings/ai" element={<SettingsAI />} />
        <Route path="/settings/invoice" element={<SettingsInvoice />} />
        <Route path="/settings/notifications" element={<SettingsNotifications />} />
        <Route path="/settings/sync" element={<SettingsSync />} />
        <Route path="/settings/privacy" element={<SettingsPrivacy />} />
        <Route path="/settings/pricing" element={<SettingsPricing />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/billing/new" element={<Billing />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/subscription" element={<SubscriptionPlans />} />
        <Route path="/payment-status" element={<PaymentStatus />} />
        <Route path="/help" element={<Help />} />
        <Route path="/checkout" element={<Checkout />} />
      </Route>
      <Route path="/auth" element={isAuthenticated ? <Navigate to="/home" replace /> : <Auth />} />
      <Route path="/policy/terms" element={<PolicyTerms />} />
      <Route path="/policy/refund" element={<PolicyRefund />} />
      <Route path="/policy/privacy" element={<PolicyPrivacy />} />
      <Route path="*" element={<NotFound />} />
    </Routes >
  );
}

import { AuthProvider } from '@/contexts/AuthContext';

// ... (existing imports)

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider defaultTheme="dark" storageKey="revonn-ui-theme">
        <LanguageProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppContent />
              </BrowserRouter>
            </SubscriptionProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
