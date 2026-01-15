import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  Calendar,
  Sparkles,
  ChevronLeft,
  ArrowUpRight
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import DemoLimitModal from '@/components/subscription/DemoLimitModal';


const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount);
};

type ViewMode = 'today' | 'week' | 'month';

interface Invoice {
  id: string;
  total: number;
  tax_amount: number;
  items: any;
  created_at: string;
}

export default function Reports() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- PRO CHECK ---
  const { isPro } = useSubscription();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitType, setLimitType] = useState<'reports' | 'export'>('reports');

  useEffect(() => {
    if (!isPro && (viewMode === 'week' || viewMode === 'month')) {
      setViewMode('today');
      setLimitType('reports');
      setShowLimitModal(true);
    }
  }, [viewMode, isPro]);

  useEffect(() => {
    setIsLoading(true);
    let unsubscribe: (() => void) | undefined;

    // Use onAuthStateChanged to wait for user to be available
    const authUnsub = auth.onAuthStateChanged(async (user) => {
      // Clear previous listener if exists
      if (unsubscribe) unsubscribe();

      const staffSessionStr = localStorage.getItem('revonn-staff-session');
      let userId = user?.uid;

      if (staffSessionStr) {
        try {
          const staffSession = JSON.parse(staffSessionStr);
          userId = staffSession.ownerId;
        } catch (e) { console.error(e); }
      }

      if (!userId) {
        setInvoices([]);
        setIsLoading(false);
        return;
      }

      const today = new Date();
      let startDate = new Date(today);

      if (viewMode === 'week') {
        startDate.setDate(today.getDate() - 7);
      } else if (viewMode === 'month') {
        startDate.setMonth(today.getMonth() - 1);
      }
      startDate.setHours(0, 0, 0, 0);

      console.log("DEBUG: Reports.tsx Fetching. UserId:", userId);
      console.log("DEBUG: StartDate:", startDate.toISOString());

      const invoicesRef = collection(db, 'invoices');
      // REMOVED orderBy to prevent Index Error. Sorting client-side.
      const q = query(
        invoicesRef,
        where('user_id', '==', userId),
        // where('created_at', '>=', startDate.toISOString()) // Temporarily removed to debug "0 Sales"
      );

      // Changed getDocs -> onSnapshot for REAL TIME updates
      unsubscribe = onSnapshot(q, (snapshot) => {
        console.log("DEBUG: Snapshot Size:", snapshot.size);
        const data: Invoice[] = [];
        snapshot.forEach((doc) => {
          const inv = { id: doc.id, ...doc.data() } as Invoice;
          // Client-side date check (Debug mode)
          if (new Date(inv.created_at) >= startDate) {
            data.push(inv);
          } else {
            console.log("DEBUG: Skipped old invoice:", inv.id, inv.created_at);
          }
        });
        // Client-side Sort
        data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        console.log("DEBUG: Final Invoices count:", data.length);
        setInvoices(data);
        setIsLoading(false);
      }, (error) => {
        console.error("Error fetching reports:", error);
        setIsLoading(false);
      });
    });

    return () => {
      authUnsub(); // Unsubscribe from auth listener
      if (unsubscribe) unsubscribe(); // Unsubscribe from firestore
    };
  }, [viewMode]);

  // loadData function removed in favor of useEffect


  // Calculate summary
  const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
  const totalItemsSold = invoices.reduce((sum, inv) => {
    const items = Array.isArray(inv.items) ? inv.items : [];
    return sum + items.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0);
  }, 0);
  const taxCollected = invoices.reduce((sum, inv) => sum + Number(inv.tax_amount || 0), 0);
  const grossProfit = totalSales - taxCollected - (totalSales * 0.6); // Estimate COGS at 60%



  const metrics = [
    { label: t('total_sales'), value: formatCurrency(totalSales), icon: IndianRupee, color: 'text-primary' },
    { label: t('items_sold'), value: totalItemsSold, icon: ShoppingBag, color: 'text-success' },
  ];

  return (
    <AppLayout title="Finance" hideNav>
      <DemoLimitModal
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType={limitType}
      />
      <div className="flex flex-col h-full bg-background/50">
        <div className="px-4 py-4 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors md:hidden"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                Finance
              </h1>
            </div>
            <button
              onClick={() => navigate('/home')}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-all group"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ask AI to Analyze</span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>

          {/* View Mode Pills */}
          <div className="flex p-1 bg-card border border-border rounded-xl">
            {(['today', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all capitalize',
                  viewMode === mode
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary'
                )}
              >
                {mode === 'today' ? t('today') : mode === 'week' ? t('days_7') : t('days_30')}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="h-40 rounded-2xl bg-card animate-pulse border border-border" />
          ) : (
            <>
              {/* Hero Card */}
              <div className="p-6 rounded-2xl gold-gradient text-primary-foreground shadow-lg relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

                <div className="relative z-10">
                  <p className="text-sm font-medium opacity-90 mb-1">{t('gross_profit')}</p>
                  <h2 className="text-4xl font-bold tracking-tight">{formatCurrency(grossProfit)}</h2>

                  <div className="mt-6 flex items-center gap-4 text-sm font-medium opacity-90">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" />
                      <span>{t('cash_in')}: {formatCurrency(totalSales)}</span>
                    </div>
                    <div className="w-1 h-1 bg-current rounded-full" />
                    <div className="flex items-center gap-1.5">
                      <TrendingDown className="w-4 h-4" />
                      <span>Tax: {formatCurrency(taxCollected)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                {metrics.map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="p-4 bg-card rounded-2xl border border-border flex flex-col justify-between h-28">
                    <div className="flex items-start justify-between">
                      <span className="text-sm text-muted-foreground font-medium">{label}</span>
                      <div className={cn("p-2 rounded-lg bg-secondary/50", color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-xl font-bold text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              {/* AI Analysis CTA */}
              <button
                onClick={() => navigate('/home')}
                className="w-full p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all text-left flex items-start gap-4 group"
              >
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">Need deeper insights?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ask Revonn AI: "How can I increase my profit margin?" or "Which items were returned most?"
                  </p>
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
