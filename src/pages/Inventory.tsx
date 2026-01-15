import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Package,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Flame,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount);
};

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  price: number;
  gst_rate: number;
  sales_count: number;
  size: string | null;
  color: string | null;
  last_sold_at: string | null;
}

type FilterType = 'all' | 'low-stock' | 'top-selling';

export default function Inventory() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    // Auth listener
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();

      let userId: string | undefined;
      const staffSessionStr = localStorage.getItem('revonn-staff-session');

      if (staffSessionStr) {
        const staffSession = JSON.parse(staffSessionStr);
        userId = staffSession.ownerId;
      } else if (user) {
        userId = user.uid;
      }

      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'inventory'),
          where('user_id', '==', userId)
        );

        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const data: InventoryItem[] = [];
          snapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() } as InventoryItem);
          });

          // Client-side sort
          data.sort((a, b) => b.sales_count - a.sales_count);
          setItems(data);
          setIsLoading(false);
        }, (error) => {
          console.error("Error listening to inventory", error);
          setIsLoading(false);
        });

      } catch (error) {
        console.error('Error setting up inventory listener:', error);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);


  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase());

    if (filter === 'low-stock') {
      return matchesSearch && item.quantity <= 5;
    }

    if (filter === 'top-selling') {
      return matchesSearch && item.sales_count > 0;
    }

    return matchesSearch;
  });

  // Sort by sales_count for top-selling filter
  const sortedItems = filter === 'top-selling'
    ? [...filteredItems].sort((a, b) => b.sales_count - a.sales_count)
    : filteredItems;

  const lowStockCount = items.filter(i => i.quantity <= 5).length;
  const topSellingCount = items.filter(i => i.sales_count > 0).length;

  return (
    <AppLayout title={t('inventory')} hideNav>
      <div className="flex flex-col h-full bg-background/50">
        <div className="px-4 py-4 space-y-4">
          {/* Header with AI CTA */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              {t('inventory')}
            </h1>
            <button
              onClick={() => navigate('/home')}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-all group"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ask AI to Add Stock</span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>

          {/* Mobile AI CTA */}
          <button
            onClick={() => navigate('/home')}
            className="md:hidden w-full p-4 rounded-2xl gold-gradient text-primary-foreground shadow-lg flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-bold text-lg">Add New Stock</p>
                <p className="text-xs opacity-90">Just upload photo or tell AI</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 opacity-90 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('search_items')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border shadow-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap border',
                filter === 'all'
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {t('all')} ({items.length})
            </button>
            <button
              onClick={() => setFilter('top-selling')}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1 border',
                filter === 'top-selling'
                  ? 'bg-warning/10 text-warning border-warning/20'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              )}
            >
              <Flame className="w-3 h-3" />
              {t('top_selling')} ({topSellingCount})
            </button>
            <button
              onClick={() => setFilter('low-stock')}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap border',
                filter === 'low-stock'
                  ? 'bg-destructive/10 text-destructive border-destructive/20'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              )}
            >
              <AlertTriangle className="w-3 h-3" />
              {t('low_stock')} ({lowStockCount})
            </button>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 rounded-2xl bg-card animate-pulse border border-border" />
                ))}
              </div>
            ) : sortedItems.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-1">{t('no_items_found')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ask AI to add new items.
                </p>
              </div>
            ) : (
              sortedItems.map((item, index) => {
                const isLowStock = item.quantity <= 5;
                const isTopSeller = item.sales_count > 0 && index < 5 && filter !== 'low-stock';

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-4 bg-card rounded-2xl border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer group"
                    onClick={() => navigate(`/inventory/${item.id}`)}
                  >
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center relative transition-colors',
                      isLowStock ? 'bg-destructive/10' : isTopSeller ? 'bg-warning/10' : 'bg-secondary group-hover:bg-primary/5'
                    )}>
                      <Package className={cn(
                        'w-6 h-6 transition-colors',
                        isLowStock ? 'text-destructive' : isTopSeller ? 'text-warning' : 'text-muted-foreground group-hover:text-primary'
                      )} />
                      {isTopSeller && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                          {index + 1}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">{item.name}</h3>
                        {isLowStock && (
                          <span className="badge-low-stock flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-destructive/10 text-destructive rounded-md">
                            <AlertTriangle className="w-3 h-3" />
                            {t('low_stock')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.sku && `${item.sku} • `}
                        {t('stock')}: <span className={cn("font-medium", isLowStock ? "text-destructive" : "text-foreground")}>{item.quantity}</span> • {formatCurrency(Number(item.price))}
                      </p>
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors hover:translate-x-1" />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
