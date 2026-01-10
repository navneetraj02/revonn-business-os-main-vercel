import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, Crown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

interface SubscriptionPlansProps {
  trigger?: string;
  onClose?: () => void;
}

// Single plan - Revonn Pro with all features
const revonnProFeatures = [
  // Digital Billing & Invoicing
  { category: 'billing', en: 'GST & Non-GST invoices (PDF)', hi: 'जीएसटी और नॉन-जीएसटी इनवॉयस (पीडीएफ)' },
  { category: 'billing', en: 'Item variants (size, color)', hi: 'आइटम वेरिएंट (साइज, कलर)' },
  { category: 'billing', en: 'Discounts & WhatsApp sharing', hi: 'डिस्काउंट और व्हाट्सएप शेयरिंग' },
  { category: 'billing', en: 'Daily bill summary', hi: 'दैनिक बिल सारांश' },
  
  // Inventory & Stock Management  
  { category: 'inventory', en: 'Unlimited inventory items', hi: 'असीमित इन्वेंट्री आइटम' },
  { category: 'inventory', en: 'Auto stock deduction on billing', hi: 'बिलिंग पर ऑटो स्टॉक कटौती' },
  { category: 'inventory', en: 'Low-stock alerts & insights', hi: 'कम स्टॉक अलर्ट और इनसाइट्स' },
  
  // Customer CRM
  { category: 'crm', en: 'Unlimited customers', hi: 'असीमित ग्राहक' },
  { category: 'crm', en: 'Purchase history & tagging', hi: 'खरीद इतिहास और टैगिंग' },
  { category: 'crm', en: 'Outstanding balance tracking', hi: 'बकाया राशि ट्रैकिंग' },
  
  // Finance & Reports
  { category: 'reports', en: 'Daily & monthly sales reports', hi: 'दैनिक और मासिक बिक्री रिपोर्ट' },
  { category: 'reports', en: 'Profit & Loss summary', hi: 'लाभ और हानि सारांश' },
  { category: 'reports', en: 'Expense & cash tracking', hi: 'खर्च और कैश ट्रैकिंग' },
  
  // Staff Management
  { category: 'staff', en: 'Staff management & attendance', hi: 'स्टाफ प्रबंधन और उपस्थिति' },
  { category: 'staff', en: 'Role-based access control', hi: 'रोल-आधारित एक्सेस कंट्रोल' },
  { category: 'staff', en: 'Salary calculation', hi: 'वेतन गणना' },
  
  // AI Assistant
  { category: 'ai', en: 'AI-assisted billing (voice & text)', hi: 'एआई-सहायता बिलिंग (वॉयस और टेक्स्ट)' },
  { category: 'ai', en: 'AI inventory & sales insights', hi: 'एआई इन्वेंट्री और सेल्स इनसाइट्स' },
  { category: 'ai', en: 'Marketing content generation', hi: 'मार्केटिंग कंटेंट जेनरेशन' },
  
  // Multi-User
  { category: 'multi', en: 'Multi-user & multi-device', hi: 'मल्टी-यूज़र और मल्टी-डिवाइस' },
  { category: 'multi', en: 'Owner + Staff login', hi: 'मालिक + स्टाफ लॉगिन' },
];

export const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ trigger, onClose }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'yearly'>('yearly');
  const isHindi = language === 'hi';

  const monthlyPrice = 299;
  const yearlyPrice = 2999;
  const yearlySavings = (monthlyPrice * 12) - yearlyPrice; // ₹589 savings

  const triggerMessages: { [key: string]: { en: string; hi: string } } = {
    bills: { en: "You've reached the demo limit of 5 bills.", hi: "आपने 5 बिल की डेमो सीमा पूरी कर ली है।" },
    inventory: { en: "You've reached the demo limit of 10 inventory items.", hi: "आपने 10 इन्वेंट्री आइटम की डेमो सीमा पूरी कर ली है।" },
    customers: { en: "You've reached the demo limit of 10 customers.", hi: "आपने 10 ग्राहक की डेमो सीमा पूरी कर ली है।" },
    gst: { en: "GST features require Revonn Pro.", hi: "जीएसटी फीचर्स के लिए रेवॉन प्रो चाहिए।" },
    staff: { en: "Staff management requires Revonn Pro.", hi: "स्टाफ प्रबंधन के लिए रेवॉन प्रो चाहिए।" },
    reports: { en: "Advanced reports require Revonn Pro.", hi: "एडवांस्ड रिपोर्ट के लिए रेवॉन प्रो चाहिए।" },
    demo_expired: { en: "You've reached the free demo limit. Choose a plan to continue.", hi: "आपने फ्री डेमो सीमा पूरी कर ली है। जारी रखने के लिए प्लान चुनें।" },
  };

  const handleSubscribe = () => {
    navigate('/checkout', {
      state: {
        plan: 'pro',
        billingCycle,
        total: billingCycle === 'monthly' ? monthlyPrice : yearlyPrice,
        planName: 'Revonn Pro'
      }
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Main Headline */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {isHindi ? 'एक प्लान। सब कुछ शामिल।' : 'One Plan. Everything Included.'}
          </h1>
          {trigger && triggerMessages[trigger] && (
            <p className="text-destructive text-sm font-medium">
              {isHindi ? triggerMessages[trigger].hi : triggerMessages[trigger].en}
            </p>
          )}
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
              billingCycle === 'monthly' 
                ? 'bg-primary text-primary-foreground shadow-lg' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {isHindi ? 'मासिक' : 'Monthly'}
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${
              billingCycle === 'yearly' 
                ? 'bg-primary text-primary-foreground shadow-lg' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {isHindi ? 'वार्षिक' : 'Yearly'}
            <Badge className="bg-success/90 text-white text-xs px-1.5 py-0.5">
              {isHindi ? 'बेस्ट वैल्यू' : 'Best Value'}
            </Badge>
          </button>
        </div>

        {/* Single Plan Card - Revonn Pro */}
        <Card className="p-6 border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10 shadow-xl mb-6">
          {/* Popular Badge */}
          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary px-4 py-1">
            <Crown className="w-3 h-3 mr-1" />
            {isHindi ? 'रेवॉन प्रो' : 'Revonn Pro'}
          </Badge>
          
          {/* Price Display */}
          <div className="text-center pt-4 pb-6 border-b border-border mb-6">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-foreground">
                ₹{billingCycle === 'monthly' ? monthlyPrice : yearlyPrice}
              </span>
              <span className="text-muted-foreground text-lg">
                /{billingCycle === 'monthly' ? (isHindi ? 'महीना' : 'month') : (isHindi ? 'वर्ष' : 'year')}
              </span>
            </div>
            
            {billingCycle === 'yearly' && (
              <div className="mt-2 flex items-center justify-center gap-2">
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {isHindi ? `₹${yearlySavings} बचाएं मासिक की तुलना में` : `Save ₹${yearlySavings} compared to monthly`}
                </Badge>
              </div>
            )}
          </div>

          {/* All Features List */}
          <div className="space-y-2 mb-6">
            {revonnProFeatures.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span className="text-foreground text-sm">
                  {isHindi ? feature.hi : feature.en}
                </span>
              </div>
            ))}
          </div>

          {/* Subscribe Button */}
          <Button 
            className="w-full btn-gold py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all" 
            onClick={handleSubscribe}
          >
            {isHindi 
              ? `₹${billingCycle === 'monthly' ? monthlyPrice : yearlyPrice} में सब्सक्राइब करें`
              : `Subscribe for ₹${billingCycle === 'monthly' ? monthlyPrice : yearlyPrice}`
            }
          </Button>
        </Card>

        {/* All Features Included Note */}
        <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-xl p-4 mb-6">
          <p className="font-medium text-foreground mb-1">
            {isHindi ? '✨ सभी फीचर्स मासिक और वार्षिक दोनों प्लान में शामिल' : '✨ All features included in both monthly and yearly plans'}
          </p>
          <p>
            {isHindi ? 'कोई छुपी फीस नहीं, कोई ऐड-ऑन नहीं' : 'No hidden fees, no add-ons required'}
          </p>
        </div>

        {/* Demo Info */}
        <div className="text-center text-sm text-muted-foreground">
          <p className="font-medium mb-1">
            {isHindi ? 'फ्री डेमो में शामिल:' : 'Free demo includes:'}
          </p>
          <p>
            {isHindi 
              ? '5 बिल • 10 इन्वेंट्री आइटम • 10 ग्राहक • आज की सेल्स समरी'
              : '5 bills • 10 inventory items • 10 customers • Today\'s sales summary'
            }
          </p>
          <p className="mt-2 text-xs">
            {isHindi 
              ? 'सब्सक्रिप्शन के बाद सभी डेमो डेटा सुरक्षित रहेगा।' 
              : 'All demo data will be preserved after subscription.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPlans;
