import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Users,
  Phone,
  Calendar,
  IndianRupee,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  Key,
  Shield,
  Eye,
  EyeOff,
  Settings,
  Edit,
  Receipt,
  BarChart3,
  FileText,
  Trash2
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount);
};

interface Staff {
  id: string;
  name: string;
  phone: string | null;
  role: string | null;
  salary: number;
  username: string | null;
  permissions: {
    billing: boolean;
    inventory: boolean;
    customers: boolean;
    reports: boolean;
    settings: boolean;
  };
  is_active: boolean;
  last_login?: string | null;
  join_date?: string | null;
}

interface StaffAnalytics {
  bills_created: number;
  total_sales: number;
  days_present: number;
  days_absent: number;
}

interface Attendance {
  id: string;
  staff_id: string;
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
}

import { useSubscription } from '@/contexts/SubscriptionContext';
import DemoLimitModal from '@/components/subscription/DemoLimitModal';

export default function StaffPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isHindi = language === 'hi';

  // --- PRO CHECK START ---
  const { isPro, loading: subLoading } = useSubscription();
  const [showProModal, setShowProModal] = useState(false);

  useEffect(() => {
    if (!subLoading && !isPro) {
      setShowProModal(true);
    }
  }, [isPro, subLoading]);

  // --- PRO CHECK END ---

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [staffAnalytics, setStaffAnalytics] = useState<StaffAnalytics | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerPhone, setOwnerPhone] = useState<string | null>(null);

  const [newStaff, setNewStaff] = useState({
    name: '',
    phone: '',
    role: 'staff' as string,
    salary: 0,
    username: '',
    password: '',
    permissions: {
      billing: true,
      inventory: false,
      customers: false,
      reports: false,
      settings: false
    }
  });

  const [editStaff, setEditStaff] = useState({
    name: '',
    phone: '',
    role: '',
    salary: 0,
    username: '',
    password: '',
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        navigate('/auth');
        return;
      }

      setOwnerId(user.uid);

      // Get owner's phone for staff login reference
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        setOwnerPhone(userData.phone);
      }

      // Load staff from Firestore
      const staffRef = collection(db, 'staff');
      const staffQ = query(staffRef, where('user_id', '==', user.uid));
      const staffSnap = await getDocs(staffQ);

      const staffData: any[] = [];
      staffSnap.forEach((doc) => {
        staffData.push({ id: doc.id, ...doc.data() });
      });

      const formattedStaff: Staff[] = staffData.map(s => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        role: s.role,
        salary: Number(s.salary) || 0,
        username: s.username,
        permissions: (typeof s.permissions === 'object' && s.permissions !== null && !Array.isArray(s.permissions))
          ? s.permissions as Staff['permissions']
          : { billing: true, inventory: false, customers: false, reports: false, settings: false },
        is_active: s.is_active ?? true,
        last_login: s.last_login,
        join_date: s.join_date
      }));

      setStaffList(formattedStaff);

      // Load today's attendance
      const today = new Date().toISOString().split('T')[0];
      const attRef = collection(db, 'staff_attendance');
      const attQ = query(
        attRef,
        where('user_id', '==', user.uid),
        where('date', '==', today)
      );
      const attSnap = await getDocs(attQ);

      const attData: Attendance[] = [];
      attSnap.forEach((doc) => {
        attData.push({ id: doc.id, ...doc.data() } as Attendance);
      });

      setAttendance(attData);
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error(isHindi ? 'डेटा लोड करने में त्रुटि' : 'Error loading data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStaffAnalytics = async (staffId: string) => {
    try {
      // Get attendance stats for this month
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthAgoStr = monthAgo.toISOString().split('T')[0];

      const attRef = collection(db, 'staff_attendance');
      const attQ = query(
        attRef,
        where('staff_id', '==', staffId),
        where('date', '>=', monthAgoStr)
      );
      const attSnap = await getDocs(attQ);

      let daysPresent = 0;
      let daysAbsent = 0;

      attSnap.forEach((doc) => {
        const status = doc.data().status;
        if (status === 'present') daysPresent++;
        if (status === 'absent') daysAbsent++;
      });

      // Since we don't track which staff created which invoice directly,
      // we'll show general stats for now
      setStaffAnalytics({
        bills_created: 0, // Would need staff_id on invoices to track
        total_sales: 0,
        days_present: daysPresent,
        days_absent: daysAbsent
      });
    } catch (error) {
      console.error('Error loading staff analytics:', error);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.phone) {
      toast.error(isHindi ? 'कृपया नाम और फ़ोन भरें' : 'Please fill name and phone');
      return;
    }

    if (newStaff.username && !newStaff.password) {
      toast.error(isHindi ? 'पासवर्ड आवश्यक है' : 'Password is required for staff login');
      return;
    }

    if (newStaff.username && newStaff.password.length < 4) {
      toast.error(isHindi ? 'पासवर्ड कम से कम 4 अक्षर का होना चाहिए' : 'Password must be at least 4 characters');
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) return;

      // Simple password hash (base64 encoded)
      const passwordHash = newStaff.password ? btoa(newStaff.password) : null;
      const staffRef = collection(db, 'staff');
      const newStaffDoc = await addDoc(staffRef, {
        user_id: user.uid,
        name: newStaff.name,
        phone: newStaff.phone,
        role: newStaff.role,
        salary: newStaff.salary,
        username: newStaff.username || null,
        password_hash: passwordHash,
        permissions: newStaff.permissions,
        is_active: true,
        join_date: new Date().toISOString().split('T')[0]
      });

      const newStaffMember: Staff = {
        id: newStaffDoc.id,
        name: newStaff.name,
        phone: newStaff.phone,
        role: newStaff.role,
        salary: Number(newStaff.salary) || 0,
        username: newStaff.username,
        permissions: newStaff.permissions,
        is_active: true,
        join_date: new Date().toISOString().split('T')[0]
      };

      setStaffList([...staffList, newStaffMember]);
      setShowAddModal(false);
      setNewStaff({
        name: '',
        phone: '',
        role: 'staff',
        salary: 0,
        username: '',
        password: '',
        permissions: { billing: true, inventory: false, customers: false, reports: false, settings: false }
      });
      toast.success(isHindi ? 'स्टाफ जोड़ा गया!' : 'Staff member added!');
    } catch (error) {
      console.error('Error adding staff:', error);
      toast.error(isHindi ? 'स्टाफ जोड़ने में त्रुटि' : 'Error adding staff');
    }
  };

  const handleUpdateStaff = async () => {
    if (!selectedStaff) return;

    try {
      const updates: any = {
        name: editStaff.name,
        phone: editStaff.phone,
        role: editStaff.role,
        salary: editStaff.salary,
        is_active: editStaff.is_active,
        username: editStaff.username || null
      };

      // Only update password if a new one is provided
      if (editStaff.password) {
        if (editStaff.password.length < 4) {
          toast.error(isHindi ? 'पासवर्ड कम से कम 4 अक्षर का होना चाहिए' : 'Password must be at least 4 characters');
          return;
        }
        updates.password_hash = btoa(editStaff.password);
      }

      const staffDocRef = doc(db, 'staff', selectedStaff.id);
      await updateDoc(staffDocRef, updates);

      setStaffList(prev => prev.map(s =>
        s.id === selectedStaff.id
          ? {
            ...s,
            name: editStaff.name,
            phone: editStaff.phone,
            role: editStaff.role,
            salary: editStaff.salary,
            username: editStaff.username,
            is_active: editStaff.is_active
          }
          : s
      ));
      setShowEditModal(false);
      toast.success(isHindi ? 'स्टाफ अपडेट हुआ!' : 'Staff updated!');
    } catch (error) {
      console.error('Error updating staff:', error);
      toast.error(isHindi ? 'अपडेट में त्रुटि' : 'Error updating');
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm(isHindi ? 'क्या आप इस स्टाफ को हटाना चाहते हैं?' : 'Are you sure you want to delete this staff member?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'staff', staffId));

      setStaffList(prev => prev.filter(s => s.id !== staffId));
      setShowDetailModal(false);
      toast.success(isHindi ? 'स्टाफ हटाया गया!' : 'Staff deleted!');
    } catch (error) {
      console.error('Error deleting staff:', error);
      toast.error(isHindi ? 'हटाने में त्रुटि' : 'Error deleting');
    }
  };

  const markAttendance = async (staffId: string, status: 'present' | 'absent' | 'half-day') => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const existingToday = attendance.find(a => a.staff_id === staffId);

      if (existingToday) {
        const attDocRef = doc(db, 'staff_attendance', existingToday.id);
        await updateDoc(attDocRef, {
          status,
          check_in: status === 'present' || status === 'half-day' ? new Date().toISOString() : null
        });

        setAttendance(prev => prev.map(a =>
          a.id === existingToday.id ? { ...a, status } : a
        ));
      } else {
        const attRef = collection(db, 'staff_attendance');
        const newAttDoc = await addDoc(attRef, {
          user_id: user.uid,
          staff_id: staffId,
          date: today,
          status,
          check_in: status === 'present' || status === 'half-day' ? new Date().toISOString() : null
        });

        const newAttendance: Attendance = {
          id: newAttDoc.id,
          staff_id: staffId,
          date: today,
          status,
          check_in: status === 'present' || status === 'half-day' ? new Date().toISOString() : null,
          check_out: null
        };

        setAttendance([...attendance, newAttendance]);
      }
      toast.success(isHindi ? 'हाजिरी दर्ज!' : 'Attendance marked!');
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast.error(isHindi ? 'हाजिरी में त्रुटि' : 'Error marking attendance');
    }
  };

  const updatePermissions = async () => {
    if (!selectedStaff) return;

    try {
      const staffDocRef = doc(db, 'staff', selectedStaff.id);
      await updateDoc(staffDocRef, { permissions: selectedStaff.permissions });

      setStaffList(prev => prev.map(s =>
        s.id === selectedStaff.id ? selectedStaff : s
      ));
      setShowPermissionsModal(false);
      toast.success(isHindi ? 'अनुमतियां अपडेट!' : 'Permissions updated!');
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error(isHindi ? 'अपडेट में त्रुटि' : 'Error updating');
    }
  };

  const getStaffAttendance = (staffId: string) => {
    return attendance.find(a => a.staff_id === staffId);
  };

  const filteredStaff = staffList.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone?.includes(searchQuery)
  );

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;

  const openStaffDetail = async (staff: Staff) => {
    setSelectedStaff(staff);
    await loadStaffAnalytics(staff.id);
    setShowDetailModal(true);
  };

  const openEditModal = (staff: Staff) => {
    setSelectedStaff(staff);
    setEditStaff({
      name: staff.name,
      phone: staff.phone || '',
      role: staff.role || 'staff',
      salary: staff.salary,
      username: staff.username || '',
      password: '', // Don't show existing password
      is_active: staff.is_active
    });
    setShowEditModal(true);
  };

  const permissionLabels: { [key: string]: { en: string; hi: string } } = {
    billing: { en: 'Billing', hi: 'बिलिंग' },
    inventory: { en: 'Inventory', hi: 'इन्वेंट्री' },
    customers: { en: 'Customers', hi: 'ग्राहक' },
    reports: { en: 'Reports', hi: 'रिपोर्ट' },
    settings: { en: 'Settings', hi: 'सेटिंग्स' }
  };

  return (
    <AppLayout title={isHindi ? 'स्टाफ' : 'Staff'}>
      <DemoLimitModal
        open={showProModal}
        onClose={() => navigate('/dashboard')}
        limitType="staff"
      />
      <div className="px-4 py-4 space-y-4">
        {/* Staff Login Info Banner */}
        {ownerPhone && (
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-xs text-muted-foreground">
              {isHindi
                ? `स्टाफ लॉगिन के लिए स्टोर फ़ोन: ${ownerPhone}`
                : `Store phone for staff login: ${ownerPhone}`
              }
            </p>
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={isHindi ? 'स्टाफ खोजें...' : 'Search staff...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-3 rounded-xl bg-primary text-primary-foreground"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-card text-center">
            <p className="text-2xl font-bold text-foreground">{staffList.length}</p>
            <p className="text-xs text-muted-foreground">{isHindi ? 'कुल स्टाफ' : 'Total Staff'}</p>
          </div>
          <div className="p-3 rounded-xl bg-card text-center">
            <p className="text-2xl font-bold text-success">{presentCount}</p>
            <p className="text-xs text-muted-foreground">{isHindi ? 'उपस्थित' : 'Present'}</p>
          </div>
          <div className="p-3 rounded-xl bg-card text-center">
            <p className="text-2xl font-bold text-destructive">{absentCount}</p>
            <p className="text-xs text-muted-foreground">{isHindi ? 'अनुपस्थित' : 'Absent'}</p>
          </div>
        </div>

        {/* Today's Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          {new Date().toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </div>

        {/* Staff List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-1">
                {isHindi ? 'कोई स्टाफ नहीं' : 'No staff members'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isHindi ? 'पहला स्टाफ जोड़ें' : 'Add your first staff member'}
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium"
              >
                <Plus className="w-4 h-4" />
                {isHindi ? 'स्टाफ जोड़ें' : 'Add Staff'}
              </button>
            </div>
          ) : (
            filteredStaff.map((staff) => {
              const att = getStaffAttendance(staff.id);
              return (
                <div
                  key={staff.id}
                  className={cn(
                    "p-4 bg-card rounded-xl border",
                    staff.is_active ? 'border-border' : 'border-destructive/30 opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="flex items-center gap-3 cursor-pointer flex-1"
                      onClick={() => openStaffDetail(staff)}
                    >
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">
                          {staff.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">{staff.name}</h3>
                          {!staff.is_active && (
                            <span className="text-xs text-destructive">(Inactive)</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {staff.phone || 'N/A'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground capitalize">
                            {staff.role} • {formatCurrency(staff.salary)}/{isHindi ? 'माह' : 'month'}
                          </span>
                          {staff.username && (
                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] flex items-center gap-1">
                              <Key className="w-2.5 h-2.5" />
                              {staff.username}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {att && (
                        <span className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          att.status === 'present' && 'bg-success/10 text-success',
                          att.status === 'absent' && 'bg-destructive/10 text-destructive',
                          att.status === 'half-day' && 'bg-warning/10 text-warning'
                        )}>
                          {att.status === 'half-day' ? (isHindi ? 'आधा दिन' : 'Half Day') : att.status}
                        </span>
                      )}
                      <button
                        onClick={() => openEditModal(staff)}
                        className="p-1.5 rounded-lg hover:bg-secondary"
                      >
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStaff(staff);
                          setShowPermissionsModal(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-secondary"
                      >
                        <Shield className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* Attendance Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => markAttendance(staff.id, 'present')}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1',
                        att?.status === 'present'
                          ? 'bg-success text-success-foreground'
                          : 'bg-success/10 text-success hover:bg-success/20'
                      )}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isHindi ? 'उपस्थित' : 'Present'}
                    </button>
                    <button
                      onClick={() => markAttendance(staff.id, 'half-day')}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1',
                        att?.status === 'half-day'
                          ? 'bg-warning text-warning-foreground'
                          : 'bg-warning/10 text-warning hover:bg-warning/20'
                      )}
                    >
                      <Clock className="w-4 h-4" />
                      {isHindi ? 'आधा दिन' : 'Half Day'}
                    </button>
                    <button
                      onClick={() => markAttendance(staff.id, 'absent')}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1',
                        att?.status === 'absent'
                          ? 'bg-destructive text-destructive-foreground'
                          : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                      )}
                    >
                      <XCircle className="w-4 h-4" />
                      {isHindi ? 'अनुपस्थित' : 'Absent'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-foreground">
              {isHindi ? 'स्टाफ जोड़ें' : 'Add Staff Member'}
            </h2>

            <div className="space-y-3">
              <input
                type="text"
                placeholder={isHindi ? 'नाम *' : 'Name *'}
                value={newStaff.name}
                onChange={(e) => setNewStaff(prev => ({ ...prev, name: e.target.value }))}
                className="input-field"
              />
              <input
                type="tel"
                placeholder={isHindi ? 'फ़ोन *' : 'Phone *'}
                value={newStaff.phone}
                onChange={(e) => setNewStaff(prev => ({ ...prev, phone: e.target.value }))}
                className="input-field"
              />
              <select
                value={newStaff.role}
                onChange={(e) => setNewStaff(prev => ({ ...prev, role: e.target.value }))}
                className="input-field"
              >
                <option value="staff">{isHindi ? 'स्टाफ' : 'Staff'}</option>
                <option value="manager">{isHindi ? 'मैनेजर' : 'Manager'}</option>
                <option value="cashier">{isHindi ? 'कैशियर' : 'Cashier'}</option>
              </select>
              <input
                type="number"
                placeholder={isHindi ? 'वेतन' : 'Salary'}
                value={newStaff.salary || ''}
                onChange={(e) => setNewStaff(prev => ({ ...prev, salary: Number(e.target.value) }))}
                className="input-field"
              />

              {/* Login Credentials */}
              <div className="pt-3 border-t border-border">
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  {isHindi ? 'लॉगिन क्रेडेंशियल' : 'Login Credentials'}
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  {isHindi
                    ? `स्टाफ इस स्टोर फ़ोन के साथ लॉगिन करेगा: ${ownerPhone || 'N/A'}`
                    : `Staff will login with store phone: ${ownerPhone || 'N/A'}`
                  }
                </p>
                <input
                  type="text"
                  placeholder={isHindi ? 'यूजरनेम (यूनिक)' : 'Username (unique)'}
                  value={newStaff.username}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                  className="input-field mb-2"
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isHindi ? 'पासवर्ड (कम से कम 4 अक्षर)' : 'Password (min 4 characters)'}
                    value={newStaff.password}
                    onChange={(e) => setNewStaff(prev => ({ ...prev, password: e.target.value }))}
                    className="input-field pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Permissions */}
              <div className="pt-3 border-t border-border">
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {isHindi ? 'अनुमतियां' : 'Permissions'}
                </h4>
                <div className="space-y-2">
                  {Object.entries(newStaff.permissions).map(([key, value]) => (
                    <label key={key} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                      <span className="text-sm">
                        {isHindi ? permissionLabels[key]?.hi : permissionLabels[key]?.en}
                      </span>
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setNewStaff(prev => ({
                          ...prev,
                          permissions: { ...prev.permissions, [key]: e.target.checked }
                        }))}
                        className="w-4 h-4 rounded"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium"
              >
                {isHindi ? 'रद्द' : 'Cancel'}
              </button>
              <button
                onClick={handleAddStaff}
                className="flex-1 py-3 rounded-xl btn-gold font-medium"
              >
                {isHindi ? 'जोड़ें' : 'Add Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEditModal && selectedStaff && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-foreground">
              {isHindi ? 'स्टाफ संपादित करें' : 'Edit Staff'}
            </h2>

            <div className="space-y-3">
              <input
                type="text"
                placeholder={isHindi ? 'नाम' : 'Name'}
                value={editStaff.name}
                onChange={(e) => setEditStaff(prev => ({ ...prev, name: e.target.value }))}
                className="input-field"
              />
              <input
                type="tel"
                placeholder={isHindi ? 'फ़ोन' : 'Phone'}
                value={editStaff.phone}
                onChange={(e) => setEditStaff(prev => ({ ...prev, phone: e.target.value }))}
                className="input-field"
              />
              <select
                value={editStaff.role}
                onChange={(e) => setEditStaff(prev => ({ ...prev, role: e.target.value }))}
                className="input-field"
              >
                <option value="staff">{isHindi ? 'स्टाफ' : 'Staff'}</option>
                <option value="manager">{isHindi ? 'मैनेजर' : 'Manager'}</option>
                <option value="cashier">{isHindi ? 'कैशियर' : 'Cashier'}</option>
              </select>
              <input
                type="number"
                placeholder={isHindi ? 'वेतन' : 'Salary'}
                value={editStaff.salary || ''}
                onChange={(e) => setEditStaff(prev => ({ ...prev, salary: Number(e.target.value) }))}
                className="input-field"
              />

              <label className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <span className="font-medium">{isHindi ? 'सक्रिय' : 'Active'}</span>
                <input
                  type="checkbox"
                  checked={editStaff.is_active}
                  onChange={(e) => setEditStaff(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-5 h-5 rounded"
                />
              </label>

              {/* Login Credentials Update */}
              <div className="pt-3 border-t border-border">
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  {isHindi ? 'लॉगिन अपडेट करें' : 'Update Login'}
                </h4>
                <input
                  type="text"
                  placeholder={isHindi ? 'यूजरनेम' : 'Username'}
                  value={editStaff.username}
                  onChange={(e) => setEditStaff(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                  className="input-field mb-2"
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isHindi ? 'नया पासवर्ड (खाली छोड़ें अगर बदलना नहीं है)' : 'New password (leave empty to keep current)'}
                    value={editStaff.password}
                    onChange={(e) => setEditStaff(prev => ({ ...prev, password: e.target.value }))}
                    className="input-field pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium"
              >
                {isHindi ? 'रद्द' : 'Cancel'}
              </button>
              <button
                onClick={handleUpdateStaff}
                className="flex-1 py-3 rounded-xl btn-gold font-medium"
              >
                {isHindi ? 'सेव करें' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedStaff && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-slide-up">
            <h2 className="text-xl font-bold text-foreground">
              {isHindi ? 'अनुमतियां - ' : 'Permissions - '}{selectedStaff.name}
            </h2>

            <div className="space-y-2">
              {Object.entries(selectedStaff.permissions).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <span className="font-medium">
                    {isHindi ? permissionLabels[key]?.hi : permissionLabels[key]?.en}
                  </span>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setSelectedStaff({
                      ...selectedStaff,
                      permissions: { ...selectedStaff.permissions, [key]: e.target.checked }
                    })}
                    className="w-5 h-5 rounded"
                  />
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="flex-1 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium"
              >
                {isHindi ? 'रद्द' : 'Cancel'}
              </button>
              <button
                onClick={updatePermissions}
                className="flex-1 py-3 rounded-xl btn-gold font-medium"
              >
                {isHindi ? 'सेव करें' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Detail Modal */}
      {showDetailModal && selectedStaff && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {selectedStaff.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selectedStaff.name}</h2>
                  <p className="text-sm text-muted-foreground capitalize">{selectedStaff.role}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 rounded-lg hover:bg-secondary"
              >
                ✕
              </button>
            </div>

            {/* Staff Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Phone className="w-4 h-4" />
                  <span className="text-xs">{isHindi ? 'फ़ोन' : 'Phone'}</span>
                </div>
                <p className="font-medium">{selectedStaff.phone || 'N/A'}</p>
              </div>
              <div className="p-3 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <IndianRupee className="w-4 h-4" />
                  <span className="text-xs">{isHindi ? 'वेतन' : 'Salary'}</span>
                </div>
                <p className="font-medium">{formatCurrency(selectedStaff.salary)}/{isHindi ? 'माह' : 'mo'}</p>
              </div>
              <div className="p-3 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Key className="w-4 h-4" />
                  <span className="text-xs">{isHindi ? 'यूज़रनेम' : 'Username'}</span>
                </div>
                <p className="font-medium">{selectedStaff.username || 'Not set'}</p>
              </div>
              <div className="p-3 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs">{isHindi ? 'अंतिम लॉगिन' : 'Last Login'}</span>
                </div>
                <p className="font-medium text-sm">
                  {selectedStaff.last_login
                    ? new Date(selectedStaff.last_login).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
            </div>

            {/* Permissions Display */}
            <div className="p-3 rounded-xl bg-secondary/50">
              <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                {isHindi ? 'अनुमतियां' : 'Permissions'}
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selectedStaff.permissions).map(([key, value]) => (
                  value && (
                    <span key={key} className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs capitalize">
                      {isHindi ? permissionLabels[key]?.hi : permissionLabels[key]?.en}
                    </span>
                  )
                ))}
              </div>
            </div>

            {/* Analytics */}
            {staffAnalytics && (
              <div className="p-3 rounded-xl bg-secondary/50">
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  {isHindi ? 'इस महीने' : 'This Month'}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-2xl font-bold text-success">{staffAnalytics.days_present}</p>
                    <p className="text-xs text-muted-foreground">{isHindi ? 'उपस्थित दिन' : 'Days Present'}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{staffAnalytics.days_absent}</p>
                    <p className="text-xs text-muted-foreground">{isHindi ? 'अनुपस्थित दिन' : 'Days Absent'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  openEditModal(selectedStaff);
                }}
                className="flex-1 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                {isHindi ? 'संपादित करें' : 'Edit'}
              </button>
              <button
                onClick={() => handleDeleteStaff(selectedStaff.id)}
                className="py-3 px-4 rounded-xl bg-destructive/10 text-destructive font-medium flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
