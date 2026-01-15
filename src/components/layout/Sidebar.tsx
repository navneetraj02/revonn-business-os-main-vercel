import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatStore } from '@/store/chat-store';
import {
    Bot,
    Receipt,
    Package,
    Users,
    UserCog,
    Wallet,
    Settings,
    MessageSquare,
    Plus,
    LogOut,
    ChevronRight,
    User
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { auth } from '@/lib/firebase';
import { useToast } from "@/components/ui/use-toast";
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
    className?: string;
    onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    const { sessions, currentSessionId, selectSession, createSession } = useChatStore();
    const { currentUser } = useAuth();

    const menuItems = [
        { icon: Bot, label: 'AI Assistant', path: '/home' },
        { icon: Receipt, label: 'Billing', path: '/billing' },
        { icon: Package, label: 'Inventory', path: '/inventory' },
        { icon: Users, label: 'Customers', path: '/customers' },
        { icon: UserCog, label: 'Staff', path: '/staff' },
        { icon: Wallet, label: 'Finance', path: '/reports' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    const handleNavigation = (path: string) => {
        navigate(path);
        if (onNavigate) onNavigate();
    };

    const handleNewChat = () => {
        const id = createSession('New Conversation', undefined, currentUser?.uid);
        navigate('/home');
        if (onNavigate) onNavigate();
    };

    const activeSessionId = location.pathname === '/home' ? currentSessionId : null;

    const handleLogout = async () => {
        try {
            await auth.signOut();
            useChatStore.getState().clearSessions();
            localStorage.removeItem('revonn-staff-session');
            navigate('/auth');
        } catch (error) {
            toast({
                title: "Error signing out",
                description: "Please try again",
                variant: "destructive",
            });
        }
    };

    return (
        <div className={cn("flex flex-col h-full bg-card border-r w-64", className)}>
            {/* Header */}
            <div className="p-6 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => handleNavigation('/home')}>
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">Revonn</span>
                </div>

                <div className="absolute right-4 top-6">
                    <ThemeToggle />
                </div>

                <Button
                    variant="outline"
                    className="w-full justify-start gap-2 mb-2 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
                    onClick={handleNewChat}
                >
                    <Plus className="h-4 w-4" />
                    New Chat
                </Button>
            </div>

            {/* Main Navigation */}
            <div className="px-3 py-4">
                <div className="space-y-1">
                    {menuItems.map((item) => (
                        <Button
                            key={item.path}
                            variant="ghost"
                            className={cn(
                                "w-full justify-start gap-3 mb-1 font-medium",
                                location.pathname === item.path
                                    ? "bg-accent text-accent-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => handleNavigation(item.path)}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-hidden px-3">
                <div className="text-xs font-semibold text-muted-foreground mb-2 px-2 uppercase tracking-wider">
                    Recent Chats
                </div>
                <ScrollArea className="h-[calc(100%-2rem)]">
                    <div className="space-y-1 pr-2">
                        {sessions.filter(s => currentUser && s.userId === currentUser.uid).length === 0 ? (
                            <div className="text-sm text-muted-foreground p-2 italic">
                                No chat history yet
                            </div>
                        ) : (
                            sessions
                                .filter(s => currentUser && s.userId === currentUser.uid)
                                .map((session) => (
                                    <Button
                                        key={session.id}
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start gap-2 h-auto py-3 px-2 text-left font-normal",
                                            activeSessionId === session.id && location.pathname === '/home'
                                                ? "bg-accent/50 text-accent-foreground"
                                                : "text-muted-foreground hover:bg-accent/20"
                                        )}
                                        onClick={() => {
                                            selectSession(session.id);
                                            handleNavigation('/home');
                                        }}
                                    >
                                        <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                                        <div className="flex-1 overflow-hidden">
                                            <div className="truncate text-sm">{session.title}</div>
                                            <div className="text-[10px] text-muted-foreground/60 truncate">
                                                {new Date(session.updatedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </Button>
                                ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* User Profile */}
            <div className="p-4 border-t border-border/40 mt-auto">
                <div className="flex items-center gap-3 w-full p-2 hover:bg-accent rounded-lg cursor-pointer transition-colors group" onClick={() => handleNavigation('/settings')}>
                    <Avatar className="h-9 w-9 border">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${currentUser?.email || 'User'}`} />
                        <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none truncate group-hover:text-primary transition-colors">
                            {currentUser?.displayName || 'Business Owner'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                            {currentUser?.email || 'user@revonn.com'}
                        </p>
                    </div>
                    <Settings className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </div>
            </div>
        </div>
    );
}
