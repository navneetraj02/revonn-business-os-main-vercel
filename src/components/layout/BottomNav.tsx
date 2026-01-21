import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FileText,
  Users,
  BarChart3,
  MessageSquare,
  Users2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

const navItems = [
  { icon: LayoutDashboard, label: 'Home', path: '/', permission: null },
  { icon: Package, label: 'Stock', path: '/inventory', permission: 'inventory' },
  { icon: FileText, label: 'Billing', path: '/billing', permission: 'billing' },
  { icon: Users, label: 'Customers', path: '/customers', permission: 'customers' },
  { icon: Users2, label: 'Staff', path: '/staff', permission: 'staff' },
];

export function BottomNav() {
  const location = useLocation();
  const { hasPermission } = useAppStore();

  const handleNavClick = (e: React.MouseEvent, locked: boolean) => {
    if (locked) {
      e.preventDefault();
      // Import toast from sonner dynamically or statically
      // Since this is a component file, standard import is better. 
      // I'll assume usage of 'sonner' same as Dashboard.
    }
  };

  return (
    <>


      <nav className="fixed bottom-0 inset-x-0 z-30 px-4 pb-4 md:hidden">
        <div className="bg-card/95 backdrop-blur-md rounded-2xl border border-border shadow-lg">
          <div className="flex items-center justify-around py-2">
            {navItems.map(({ icon: Icon, label, path, permission }) => {
              const isActive = location.pathname === path;
              const locked = permission ? !hasPermission(permission) : false;

              return (
                <Link
                  key={path}
                  to={locked ? '#' : path}
                  onClick={(e) => {
                    if (locked) {
                      e.preventDefault();
                      // Assuming simple alert or relying on the visual 'cursor-not-allowed'
                      // Dashboard does toast, we can do toast here too if imported.
                      // Let's rely on opacity/lock icon for now to be safe with imports, 
                      // or just basic preventDefault.
                    }
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[56px] relative',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                    locked && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="relative">
                    <Icon className={cn('w-5 h-5', isActive && 'stroke-[2.5px]')} />
                    {locked && (
                      <div className="absolute -top-1 -right-2 bg-background/80 rounded-full p-[1px]">
                        {/* Simple lock overlay */}
                        <div className="w-2 h-2 bg-muted-foreground rounded-full" />
                      </div>
                    )}
                  </div>
                  <span className={cn('text-[10px] font-medium', isActive && 'font-semibold')}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
