import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Search,
  FileText,
  Sparkles,
  ArrowUpRight,
  Download,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  ChevronRight
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  total?: number;
  grandTotal?: number; // Robust support for inconsistent firestore docs
  status: string;
  created_at: string;
  payment_mode: string;
  items: any[];
}

export default function Billing() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    // Auth listener to ensure we have a user before setting up the query
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      // Clean up previous snapshot listener if auth state changes
      if (unsubscribeSnapshot) unsubscribeSnapshot();

      // 1. Check for Staff Session first (override)
      const staffSessionStr = localStorage.getItem('revonn-staff-session');
      let userId = user?.uid;

      if (staffSessionStr) {
        try {
          const staffSession = JSON.parse(staffSessionStr);
          userId = staffSession.ownerId;
        } catch (e) {
          console.error("Invalid staff session");
        }
      }

      // 2. If no user and no staff session, stop loading
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        // PERF FIX: Remove orderBy to avoid "Composite Index" error. Sort in memory.
        const q = query(
          collection(db, 'invoices'),
          where('user_id', '==', userId),
          limit(50)
        );

        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const data: Invoice[] = [];
          snapshot.forEach(doc => {
            data.push({ id: doc.id, ...doc.data() } as Invoice);
          });

          // Client-side sort
          data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          setInvoices(data);
          setLoading(false);
        }, (error) => {
          console.error("Error listening to invoices", error);
          setLoading(false);
        });

      } catch (error) {
        console.error("Error setting up invoice listener", error);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);


  const filteredInvoices = invoices.filter(inv =>
    inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Invoices" hideNav>
      <div className="flex flex-col h-full bg-background/50">
        {/* Header */}
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                Billing History
              </h1>
            </div>
            <button
              onClick={() => navigate('/home')}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-all group"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ask AI to Create Bill</span>
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
                <p className="font-bold text-lg">Create New Bill</p>
                <p className="text-xs opacity-90">Just ask Revonn AI</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 opacity-90 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by invoice # or name..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border shadow-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>
        </div>

        {/* Invoice List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-2xl bg-card animate-pulse border border-border" />
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center space-y-3 opacity-60">
              <FileText className="w-12 h-12 text-muted-foreground" />
              <p className="font-medium">No invoices found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  className="group p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-secondary group-hover:bg-primary/10 transition-colors">
                        <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{inv.customer_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{inv.invoice_number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-primary">
                        ₹{(inv.total || inv.grandTotal || 0).toLocaleString('en-IN')}
                      </p>
                      <div className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
                        inv.status === 'completed'
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-warning/10 text-warning border-warning/20"
                      )}>
                        {inv.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        <span className="capitalize">{inv.status}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{format(new Date(inv.created_at), 'dd MMM yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        <span className="capitalize">{inv.payment_mode}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>View Details</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
