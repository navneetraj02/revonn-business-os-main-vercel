
import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldAlert, RefreshCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

// TODO: REPLACE WITH YOUR REAL ADMIN EMAILS
const ADMIN_EMAILS = [
    "navneetraj@example.com",
    "admin@revonn.com",
    // Add your email here to access this page!
];

interface UserData {
    id: string;
    email: string;
    displayName?: string;
    phoneNumber?: string;
    businessName?: string;
    subscriptionStatus?: 'active' | 'inactive' | 'past_due';
    subscriptionPlan?: 'free' | 'pro' | 'enterprise';
    isPro?: boolean;
    createdAt?: any;
}

export default function Admin() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        checkAdminAccess();
    }, []);

    const checkAdminAccess = async () => {
        const user = auth.currentUser;
        if (!user) {
            toast.error("Please login first");
            navigate("/auth");
            return;
        }

        // 1. Check Hardcoded List
        if (ADMIN_EMAILS.includes(user.email || "")) {
            setIsAdmin(true);
            fetchUsers();
            return;
        }

        // 2. Or Check "isAdmin" flag in Firestore (Optional explicit override)
        // You can manually set 'isAdmin: true' on your user doc in Firestore to bypass the email list
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().isAdmin === true) {
            setIsAdmin(true);
            fetchUsers();
        } else {
            // Temporary: Allow access but warn (for Dev/Demo speed)
            // In Production, you should uncomment the next line to block access:
            // navigate("/dashboard"); toast.error("Access Denied");

            toast.warning("Accessing Admin Mode (Dev Bypass). Add your email to ADMIN_EMAILS in Admin.tsx to secure this.");
            setIsAdmin(true);
            fetchUsers();
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            const usersList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as UserData));
            setUsers(usersList);
        } catch (error) {
            console.error("Error fetching users:", error);
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    const toggleSubscription = async (userId: string, currentStatus: boolean) => {
        setActionLoading(userId);
        try {
            const userRef = doc(db, "users", userId);

            // If currently Pro (true), we downgrade to Free.
            // If currently Free (false), we upgrade to Active Pro.
            const newIsPro = !currentStatus;

            await updateDoc(userRef, {
                isPro: newIsPro,
                subscriptionStatus: newIsPro ? 'active' : 'inactive',
                subscriptionPlan: newIsPro ? 'pro' : 'free',
                updatedAt: new Date()
            });

            // Update local state
            setUsers(users.map(u => u.id === userId ? {
                ...u,
                isPro: newIsPro,
                subscriptionStatus: newIsPro ? 'active' : 'inactive',
                subscriptionPlan: newIsPro ? 'pro' : 'free'
            } : u));

            toast.success(newIsPro ? "User upgraded to PRO 🚀" : "User downgraded to Free");

        } catch (error) {
            console.error("Error updating subscription:", error);
            toast.error("Failed to update subscription");
        } finally {
            setActionLoading(null);
        }
    };

    if (!isAdmin && !loading) return null;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Admin Portal 🛡️</h1>
                    <p className="text-muted-foreground">Manage users and manual subscriptions</p>
                </div>
                <Button onClick={fetchUsers} variant="outline" size="sm">
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Users ({users.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="font-medium">{user.displayName || "Unknown"}</div>
                                                <div className="text-xs text-muted-foreground">{user.businessName}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{user.email}</div>
                                                <div className="text-xs text-muted-foreground">{user.phoneNumber}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={user.subscriptionPlan === 'pro' ? "default" : "secondary"}>
                                                    {user.subscriptionPlan?.toUpperCase() || "FREE"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {user.isPro ? (
                                                        <ShieldCheck className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <ShieldAlert className="h-4 w-4 text-gray-400" />
                                                    )}
                                                    <span className="text-sm capitalize">{user.subscriptionStatus || "inactive"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant={user.isPro ? "destructive" : "default"}
                                                    disabled={actionLoading === user.id}
                                                    onClick={() => toggleSubscription(user.id, !!user.isPro)}
                                                >
                                                    {actionLoading === user.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : user.isPro ? (
                                                        "Deactivate"
                                                    ) : (
                                                        "Activate PRO"
                                                    )}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
