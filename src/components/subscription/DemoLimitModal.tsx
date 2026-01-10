import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Crown, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface DemoLimitModalProps {
  open: boolean;
  onClose: () => void;
  limitType: 'bills' | 'inventory' | 'customers' | 'gst' | 'staff' | 'reports' | 'export';
  currentCount?: number;
  maxLimit?: number;
}

const limitMessages = {
  bills: {
    title: { en: 'Demo Limit Reached', hi: 'डेमो सीमा पूरी' },
    description: { en: "You've created 5 demo invoices. Subscribe to create unlimited bills.", hi: "आपने 5 डेमो बिल बना लिए हैं। असीमित बिल के लिए सब्सक्राइब करें।" },
    icon: Lock
  },
  inventory: {
    title: { en: 'Demo Limit Reached', hi: 'डेमो सीमा पूरी' },
    description: { en: "You've added 10 demo items. Subscribe to add unlimited inventory.", hi: "आपने 10 डेमो आइटम जोड़ लिए हैं। असीमित के लिए सब्सक्राइब करें।" },
    icon: Lock
  },
  customers: {
    title: { en: 'Demo Limit Reached', hi: 'डेमो सीमा पूरी' },
    description: { en: "You've added 10 demo customers. Subscribe to add more.", hi: "आपने 10 डेमो ग्राहक जोड़ लिए हैं। और जोड़ने के लिए सब्सक्राइब करें।" },
    icon: Lock
  },
  gst: {
    title: { en: 'Pro Feature', hi: 'प्रो फीचर' },
    description: { en: 'GST invoices and compliance features require Revonn Pro.', hi: 'जीएसटी इनवॉयस और अनुपालन फीचर्स के लिए रेवॉन प्रो चाहिए।' },
    icon: Crown
  },
  staff: {
    title: { en: 'Pro Feature', hi: 'प्रो फीचर' },
    description: { en: 'Staff management and attendance require Revonn Pro.', hi: 'स्टाफ प्रबंधन और उपस्थिति के लिए रेवॉन प्रो चाहिए।' },
    icon: Crown
  },
  reports: {
    title: { en: 'Upgrade Required', hi: 'अपग्रेड आवश्यक' },
    description: { en: 'Advanced reports and weekly/monthly analytics require a subscription.', hi: 'एडवांस्ड रिपोर्ट और साप्ताहिक/मासिक एनालिटिक्स के लिए सब्सक्रिप्शन चाहिए।' },
    icon: Lock
  },
  export: {
    title: { en: 'Upgrade Required', hi: 'अपग्रेड आवश्यक' },
    description: { en: 'Export features require a subscription.', hi: 'एक्सपोर्ट फीचर्स के लिए सब्सक्रिप्शन चाहिए।' },
    icon: Lock
  }
};

export const DemoLimitModal: React.FC<DemoLimitModalProps> = ({
  open,
  onClose,
  limitType,
  currentCount,
  maxLimit
}) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isHindi = language === 'hi';
  const config = limitMessages[limitType];
  const Icon = config.icon;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm bg-card rounded-2xl shadow-xl border border-border animate-scale-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-secondary text-muted-foreground"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 text-center">
          {/* Icon */}
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-8 w-8 text-primary" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-foreground mb-2">
            {isHindi ? config.title.hi : config.title.en}
          </h2>

          {/* Description */}
          <p className="text-muted-foreground text-sm mb-2">
            {isHindi ? config.description.hi : config.description.en}
          </p>

          {/* Count display */}
          {currentCount !== undefined && maxLimit !== undefined && (
            <p className="text-sm text-muted-foreground mb-4">
              {isHindi ? `उपयोग: ${currentCount}/${maxLimit}` : `Used: ${currentCount}/${maxLimit}`}
            </p>
          )}

          {/* Price highlight */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 mb-6">
            <p className="text-sm text-muted-foreground mb-1">
              {isHindi ? 'रेवॉन प्रो' : 'Revonn Pro'}
            </p>
            <p className="text-2xl font-bold text-foreground">
              ₹299<span className="text-sm font-normal text-muted-foreground">/{isHindi ? 'महीना' : 'month'}</span>
            </p>
            <p className="text-xs text-success mt-1">
              {isHindi ? 'या ₹2999/वर्ष (₹589 बचाएं)' : 'or ₹2999/year (save ₹589)'}
            </p>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={() => {
                onClose();
                navigate('/subscription', { state: { trigger: limitType } });
              }}
              className="w-full btn-gold"
              size="lg"
            >
              {isHindi ? 'प्लान देखें' : 'View Plans'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              onClick={onClose} 
              className="w-full text-muted-foreground"
            >
              {isHindi ? 'डेमो जारी रखें' : 'Continue Demo'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoLimitModal;
