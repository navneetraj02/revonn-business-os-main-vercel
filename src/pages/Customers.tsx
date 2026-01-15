import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
  AlertCircle,
  ChevronRight,
  Phone,
  Sparkles,
  ArrowUpRight,
  ChevronLeft
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount);
};

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  total_purchases: number;
  total_dues: number;
  created_at: string;
}

export default function Customers() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: () => void;

    const setupListener = async () => {
      try {
        let userId: string | undefined;
        const staffSessionStr = localStorage.getItem('revonn-staff-session');

        if (staffSessionStr) {
          const staffSession = JSON.parse(staffSessionStr);
          userId = staffSession.ownerId;
        } else {
          const user = auth.currentUser;
          if (user) {
            userId = user.uid;
          } else {
            setIsLoading(false);
            return;
          }
        }

        if (!userId) {
          setIsLoading(false);
          return;
        }

        // PERF FIX: Remove orderBy to avoid "Composite Index" error. Sort in memory.
        const customersRef = collection(db, 'customers');
        const q = query(
          customersRef,
          where('user_id', '==', userId)
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          const data: Customer[] = [];
          snapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() } as Customer);
          });

          // Client-side sort
          data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          setCustomers(data);
          setIsLoading(false);
        }, (error) => {
          console.error("Error listening to customers", error);
          setIsLoading(false);
        });

      } catch (error) {
        console.error('Error setting up customers listener:', error);
        setIsLoading(false);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);


  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery)
  );

  const totalDues = customers.reduce((sum, c) => sum + Number(c.total_dues || 0), 0);

  return (
    <AppLayout title="Customers" hideNav>
      <div className="flex flex-col h-full bg-background/50">
        <div className="px-4 py-4 space-y-4">
          {/* Header with AI CTA */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors md:hidden"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                Customers
              </h1>
            </div>
            <button
              onClick={() => navigate('/home')}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-all group"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ask AI to Add Customer</span>
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
                <p className="font-bold text-lg">Add New Customer</p>
                <p className="text-xs opacity-90">Just tell Revonn AI</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 opacity-90 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          </button>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-card border border-border">
              <p className="text-sm text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-bold mt-1">{customers.length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border">
              <p className="text-sm text-muted-foreground">Total Dues</p>
              <p className="text-2xl font-bold mt-1 text-destructive">{formatCurrency(totalDues)}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border shadow-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 rounded-2xl bg-card animate-pulse border border-border" />
                ))}
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-1">No customers found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ask AI to add your first customer.
                </p>
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="group flex items-center gap-4 p-4 bg-card rounded-2xl border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-lg font-bold text-primary group-hover:scale-110 transition-transform">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">{customer.name}</h3>
                      {Number(customer.total_dues) > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-destructive/10 text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Due
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {customer.phone || 'No phone'}
                    </p>
                    <div className="flex gap-3 mt-1.5 text-xs">
                      <span className="text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-md">
                        Sales: {formatCurrency(Number(customer.total_purchases) || 0)}
                      </span>
                      {Number(customer.total_dues) > 0 && (
                        <span className="text-destructive font-medium bg-destructive/5 px-2 py-0.5 rounded-md">
                          Due: {formatCurrency(Number(customer.total_dues))}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-1" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
