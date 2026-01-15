import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Store,
  FileText,
  Bell,
  Database,
  Shield,
  HelpCircle,
  ChevronRight,
  Sparkles,
  Cloud,
  Download,
  Upload,
  Crown
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAppStore } from '@/store/app-store';
import { exportBackup, importBackup } from '@/lib/database';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { auth } from '@/lib/firebase';

export default function Settings() {
  const navigate = useNavigate();
  const { shopSettings, setShopSettings } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);
  const { t, language, setLanguage } = useLanguage();

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const backup = await exportBackup();
      const blob = new Blob([backup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revonn-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup exported successfully!');
    } catch (error) {
      toast.error('Error exporting backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = await importBackup(text);
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        toast.error('Error importing backup');
      }
    };
    input.click();
  };

  const sections = [
    {
      title: t('business'),
      items: [
        { icon: Store, label: t('shop_profile'), description: t('name_gstin_address'), path: '/settings/shop' },
        { icon: FileText, label: t('invoice_settings'), description: t('invoice_prefix'), path: '/settings/invoice' },
      ]
    },
    {
      title: t('subscription'),
      items: [
        { icon: Crown, label: t('pricing'), description: t('view_plans'), path: '/settings/pricing' },
      ]
    },
    {
      title: t('features'),
      items: [
        { icon: Sparkles, label: t('ai_assistant'), description: t('ai_toggle'), path: '/settings/ai' },
        { icon: Bell, label: t('notifications'), description: t('alerts_reminders'), path: '/settings/notifications' },
      ]
    },
    {
      title: t('data'),
      items: [
        { icon: Database, label: t('backup_restore'), description: t('export_import'), action: 'backup' },
        { icon: Cloud, label: t('sync_status'), description: t('pending_items'), path: '/settings/sync' },
      ]
    },
    {
      title: t('support'),
      items: [
        { icon: HelpCircle, label: t('help_faq'), description: t('get_help'), path: '/help' },
        { icon: Shield, label: t('privacy_security'), description: t('data_protection'), path: '/settings/privacy' },
      ]
    },
  ];

  return (
    <AppLayout title="Settings" hideNav>
      <div className="px-4 py-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-secondary"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
        </div>

        {/* Shop Info Card */}
        <div className="p-4 rounded-2xl gold-gradient text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold">{shopSettings.shopName}</h2>
              <p className="text-sm opacity-90">{shopSettings.gstin}</p>
            </div>
          </div>
        </div>

        {/* Language Selection */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-secondary">
                <div className="w-4 h-4 text-muted-foreground font-bold flex items-center justify-center">Aa</div>
              </div>
              <div>
                <p className="font-medium text-foreground">{t('language') || 'Language'}</p>
                <p className="text-xs text-muted-foreground">{t('select_language') || 'Choose app language'}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLanguage('en')}
              className={cn(
                "py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                language === 'en'
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-secondary border-transparent text-muted-foreground hover:bg-secondary/80"
              )}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('hi')}
              className={cn(
                "py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                language === 'hi'
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-secondary border-transparent text-muted-foreground hover:bg-secondary/80"
              )}
            >
              हिंदी (Hindi)
            </button>
          </div>
        </div>

        {/* Settings Sections */}
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {section.title}
            </h3>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {section.items.map((item, index) => (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.action === 'backup') {
                      // Show backup options
                      setIsExporting(false); // Just placeholder logic
                    } else if (item.path) {
                      navigate(item.path);
                    }
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors text-left',
                    index !== section.items.length - 1 && 'border-b border-border'
                  )}
                >
                  <div className="p-2 rounded-lg bg-secondary">
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Backup Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleExportBackup}
            disabled={isExporting}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-secondary text-secondary-foreground font-medium"
          >
            <Download className="w-4 h-4" />
            Export Backup
          </button>
          <button
            onClick={handleImportBackup}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-secondary text-secondary-foreground font-medium"
          >
            <Upload className="w-4 h-4" />
            Import Backup
          </button>
        </div>

        {/* Logout Button */}
        <button
          onClick={async () => {
            try {
              await auth.signOut();
              localStorage.removeItem('revonn-staff-session');
              window.location.href = '/auth';
            } catch (e) { console.error(e); }
          }}
          className="w-full py-3 rounded-xl bg-destructive/10 text-destructive font-medium border border-destructive/20 hover:bg-destructive/20 transition-colors"
        >
          {t('logout') || 'Log Out'}
        </button>

        {/* Version */}
        <p className="text-center text-xs text-muted-foreground">
          Revonn v2.0 • AI-First Business OS
        </p>
      </div>
    </AppLayout>
  );
}
