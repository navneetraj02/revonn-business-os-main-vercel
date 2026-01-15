import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export function MainLayout() {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const location = useLocation();

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Desktop Sidebar */}
            <Sidebar className="hidden md:flex flex-shrink-0 w-64 border-r bg-card h-full" />

            <div className="flex-1 flex flex-col h-full w-full relative">
                {/* Mobile Header */}
                <div className="md:hidden flex items-center justify-between p-4 border-b bg-card">
                    <div className="flex items-center gap-2">
                        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-72">
                                <Sidebar onNavigate={() => setIsMobileOpen(false)} className="border-none w-full h-full" />
                            </SheetContent>
                        </Sheet>
                        <span className="font-bold text-lg">Revonn</span>
                    </div>
                    <ThemeToggle />
                </div>

                {/* Main Content Area */}
                <main className="flex-1 overflow-auto bg-background/50 h-full w-full">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
