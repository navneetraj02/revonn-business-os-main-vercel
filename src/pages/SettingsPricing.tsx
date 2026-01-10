import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, Sparkles, Crown, CreditCard } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

// Single plan - Revonn Pro with all features at ₹299/month
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

export default function SettingsPricing() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const isHindi = language === 'hi';

  const monthlyPrice = 299;
  const yearlyPrice = 2999;
  const yearlySavings = (monthlyPrice * 12) - yearlyPrice; // ₹589 savings

  const handleCheckout = () => {
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
    <AppLayout title={t('pricing')} hideNav>
      <div className="px-4 py-4 pb-32 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-secondary"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {isHindi ? 'एक प्लान। सब कुछ शामिल।' : 'One Plan. Everything Included.'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isHindi ? 'रेवॉन प्रो से अपना बिज़नेस बढ़ाएं' : 'Grow your business with Revonn Pro'}
            </p>
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-2 p-1 bg-secondary rounded-xl">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              billingCycle === 'monthly' 
                ? 'bg-primary text-primary-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isHindi ? 'मासिक' : 'Monthly'}
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              billingCycle === 'yearly' 
                ? 'bg-primary text-primary-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isHindi ? 'वार्षिक' : 'Yearly'}
            <Badge variant="secondary" className="text-xs bg-success/20 text-success">
              {isHindi ? 'बेस्ट वैल्यू' : 'Best Value'}
            </Badge>
          </button>
        </div>

        {/* Single Plan Card - Revonn Pro */}
        <Card className="p-6 border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10 relative overflow-hidden">
          {/* Popular Badge */}
          <Badge className="absolute top-4 right-4 bg-primary px-3 py-1">
            <Crown className="w-3 h-3 mr-1" />
            {isHindi ? 'रेवॉन प्रो' : 'Revonn Pro'}
          </Badge>
          
          {/* Price Display */}
          <div className="pt-2 pb-6 border-b border-border mb-6">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">
                ₹{billingCycle === 'monthly' ? monthlyPrice : yearlyPrice}
              </span>
              <span className="text-muted-foreground text-lg">
                /{billingCycle === 'monthly' ? (isHindi ? 'महीना' : 'month') : (isHindi ? 'वर्ष' : 'year')}
              </span>
            </div>
            
            {billingCycle === 'yearly' && (
              <div className="mt-3">
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {isHindi ? `₹${yearlySavings} बचाएं मासिक की तुलना में` : `Save ₹${yearlySavings} compared to monthly`}
                </Badge>
              </div>
            )}
          </div>

          {/* All Features List */}
          <div className="space-y-2.5 mb-6">
            {revonnProFeatures.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span className="text-foreground text-sm">
                  {isHindi ? feature.hi : feature.en}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* All Features Note */}
        <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-xl p-4">
          <p className="font-medium text-foreground mb-1">
            {isHindi ? '✨ सभी फीचर्स दोनों प्लान में शामिल' : '✨ All features included in both plans'}
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
              ? '5 बिल • 10 इन्वेंट्री आइटम • 10 ग्राहक'
              : '5 bills • 10 inventory items • 10 customers'
            }
          </p>
        </div>

        {/* Fixed Checkout Button */}
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border">
          <Button 
            onClick={handleCheckout}
            className="w-full btn-gold flex items-center justify-center gap-2 py-6 text-lg"
            size="lg"
          >
            <CreditCard className="w-5 h-5" />
            {isHindi 
              ? `₹${billingCycle === 'monthly' ? monthlyPrice : yearlyPrice} में सब्सक्राइब करें`
              : `Subscribe for ₹${billingCycle === 'monthly' ? monthlyPrice : yearlyPrice}`
            }
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
