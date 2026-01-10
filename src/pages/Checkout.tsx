import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Shield, Loader2, Smartphone, Crown } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { auth } from '@/lib/firebase';
import { initiatePhonePePayment, checkPaymentStatus } from '@/lib/payments';
import { toast } from 'sonner';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { refreshSubscription } = useSubscription();
  const isHindi = language === 'hi';

  const { plan, billingCycle, total, planName } = location.state || {};

  const [isProcessing, setIsProcessing] = useState(false);

  if (!plan) {
    navigate('/subscription');
    return null;
  }

  const yearlySavings = billingCycle === 'yearly' ? 589 : 0;

  // We don't need the external script for the STUB mode
  // useEffect(() => { ... }, []);

  const handlePhonePePayment = async () => {
    setIsProcessing(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error(isHindi ? 'कृपया पहले लॉगिन करें' : 'Please login first');
        navigate('/auth');
        return;
      }

      // 1. Create Payment
      // Use user's phone number if available, otherwise fallback (PhonePe requires 10 digits)
      const mobileNumber = user.phoneNumber ? user.phoneNumber.replace('+91', '') : "9999999999";

      const response = await initiatePhonePePayment(total, user.uid, mobileNumber);

      const pendingData = {
        transactionId: response.transactionId,
        plan,
        billingCycle,
        amount: total,
        userId: user.uid,
        timestamp: Date.now()
      };

      localStorage.setItem('pendingTransaction', JSON.stringify(pendingData));

      if (response.success) {
        if (response.url) {
          // Real payment flow: Redirect to PhonePe
          window.location.href = response.url;
          return;
        } else if (response.transactionId) {
          // Simulation: Direct success flow
          toast.success(isHindi ? 'सिमुलेशन: भुगतान सफल' : 'Simulation: Payment Successful');
          // For simulation, we skip backend verification because the backend won't know about this fake transactionId
          setTimeout(() => {
            navigate('/payment-status', {
              state: {
                status: 'success',
                transactionId: response.transactionId,
                message: 'Simulation: Payment successful'
              }
            });
          }, 1000);
        }
      } else {
        localStorage.removeItem('pendingTransaction');
        throw new Error('Payment initiation failed');
      }

    } catch (error: any) {
      localStorage.removeItem('pendingTransaction');
      console.error('Payment error:', error);
      const msg = error.message || (isHindi ? 'पेमेंट शुरू करने में त्रुटि' : 'Error initiating payment');
      toast.error(msg);
      setIsProcessing(false);
    }
  };

  const verifyPaymentStatus = async (txnId: string) => {
    try {
      const result = await checkPaymentStatus(txnId);

      if (result.status === 'SUCCESS') {
        toast.success(isHindi ? 'भुगतान सफल!' : 'Payment Successful!');
        navigate('/payment-status', { state: { status: 'success', transactionId: txnId } });
      } else {
        toast.error(isHindi ? 'भुगतान विफल' : 'Payment Failed');
        navigate('/payment-status', { state: { status: 'failed', message: 'Payment was not successful.' } });
      }
    } catch (e) {
      console.error("Status Check Error", e);
      navigate('/payment-status', { state: { status: 'failed' } });
    }
  };

  // Unused function for stub
  // const openPhonePePayPage = ...
  // const phonePeCallback = ...

  return (
    <AppLayout title={isHindi ? 'चेकआउट' : 'Checkout'} hideNav>
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
              {isHindi ? 'चेकआउट' : 'Checkout'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isHindi ? 'अपनी खरीदारी पूरी करें' : 'Complete your purchase'}
            </p>
          </div>
        </div>

        {/* Order Summary */}
        <Card className="p-5 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/20">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">{planName || 'Revonn Pro'}</h2>
              <Badge variant="secondary" className="text-xs">
                {billingCycle === 'yearly'
                  ? (isHindi ? 'वार्षिक प्लान' : 'Yearly Plan')
                  : (isHindi ? 'मासिक प्लान' : 'Monthly Plan')
                }
              </Badge>
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {planName} ({billingCycle === 'yearly' ? (isHindi ? 'वार्षिक' : 'Yearly') : (isHindi ? 'मासिक' : 'Monthly')})
              </span>
              <span className="font-medium">₹{total}</span>
            </div>

            {yearlySavings > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>{isHindi ? 'आपकी बचत' : 'Your savings'}</span>
                <span className="font-medium">₹{yearlySavings}</span>
              </div>
            )}

            <div className="border-t border-border pt-3 flex justify-between">
              <span className="font-bold text-lg">{isHindi ? 'कुल राशि' : 'Total'}</span>
              <span className="font-bold text-lg text-primary">₹{total}</span>
            </div>
          </div>
        </Card>

        {/* Features Included */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">
            {isHindi ? '✨ शामिल सभी फीचर्स:' : '✨ All features included:'}
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <span>• {isHindi ? 'असीमित बिलिंग' : 'Unlimited billing'}</span>
            <span>• {isHindi ? 'जीएसटी इनवॉयस' : 'GST invoices'}</span>
            <span>• {isHindi ? 'इन्वेंट्री प्रबंधन' : 'Inventory management'}</span>
            <span>• {isHindi ? 'स्टाफ प्रबंधन' : 'Staff management'}</span>
            <span>• {isHindi ? 'AI असिस्टेंट' : 'AI Assistant'}</span>
            <span>• {isHindi ? 'रिपोर्ट्स और एनालिटिक्स' : 'Reports & analytics'}</span>
          </div>
        </Card>

        {/* Payment Method - PhonePe */}
        <div>
          <h2 className="font-semibold mb-4">{isHindi ? 'पेमेंट मेथड' : 'Payment Method'}</h2>

          <Card className="p-4 border-2 border-primary bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#5f259f]">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">PhonePe</p>
                <p className="text-xs text-muted-foreground">
                  UPI, Debit/Credit Card, Net Banking
                </p>
              </div>
              <Badge className="bg-success/20 text-success border-success/30">
                {isHindi ? 'सुरक्षित' : 'Secure'}
              </Badge>
            </div>
          </Card>
        </div>

        {/* Security Note */}
        <div className="flex items-center gap-2 p-3 bg-success/10 rounded-xl">
          <Shield className="w-5 h-5 text-success" />
          <p className="text-sm text-muted-foreground">
            {isHindi
              ? 'आपका भुगतान 256-bit SSL से सुरक्षित है'
              : 'Your payment is secured with 256-bit SSL encryption'
            }
          </p>
        </div>

        {/* Pay Button */}
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background border-t border-border">
          <Button
            onClick={handlePhonePePayment}
            disabled={isProcessing}
            className="w-full btn-gold py-6 text-lg font-semibold shadow-lg"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {isHindi ? 'प्रोसेसिंग...' : 'Processing...'}
              </div>
            ) : (
              <>
                {isHindi ? `₹${total} का भुगतान करें` : `Pay ₹${total}`}
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-3">
            {isHindi
              ? 'पेमेंट पर क्लिक करके आप हमारी सेवा की शर्तों से सहमत हैं'
              : 'By clicking Pay, you agree to our Terms of Service'
            }
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
