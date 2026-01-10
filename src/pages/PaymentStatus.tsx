import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { checkPaymentStatus } from '@/lib/payments';

export default function PaymentStatus() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { refreshSubscription } = useSubscription();
  const isHindi = language === 'hi';

  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // 1. Check Navigation State (Priority)
        const state = location.state as { status?: string; transactionId?: string; message?: string } | null;

        if (state?.status === 'success') {
          // Activate Subscription (Optimistic / Simulation)
          try {
            const pendingData = localStorage.getItem('pendingTransaction');
            if (pendingData) {
              const { plan, billingCycle, userId } = JSON.parse(pendingData);
              if (userId && plan === 'pro') {
                const now = new Date();
                const expiresAt = new Date();
                if (billingCycle === 'yearly') {
                  expiresAt.setFullYear(now.getFullYear() + 1);
                } else {
                  expiresAt.setMonth(now.getMonth() + 1);
                }

                const subRef = doc(db, 'user_subscriptions', userId);
                await updateDoc(subRef, {
                  plan_type: 'pro',
                  is_active: true,
                  billing_cycle: billingCycle,
                  updated_at: now.toISOString(),
                  expires_at: expiresAt.toISOString()
                });
              }
              // Clear pending transaction
              localStorage.removeItem('pendingTransaction');
            }
          } catch (dbError) {
            console.error("Failed to activate subscription (State Path):", dbError);
          }

          setStatus('success');
          setMessage(isHindi
            ? 'आपका Revonn Pro प्लान सक्रिय हो गया है!'
            : 'Your Revonn Pro plan is now active!'
          );
          await refreshSubscription();
          return;
        }

        if (state?.status === 'failed') {
          setStatus('failed');
          setMessage(state.message || (isHindi ? 'भुगतान विफल' : 'Payment failed'));
          return;
        }

        // 2. Fallback: Get pending transaction from localStorage
        const pendingData = localStorage.getItem('pendingTransaction');
        if (!pendingData) {
          // Only fail if we also didn't have state
          if (!state) {
            setStatus('failed');
            setMessage(isHindi ? 'ट्रांजैक्शन जानकारी नहीं मिली' : 'Transaction information not found');
          }
          return;
        }

        const transaction = JSON.parse(pendingData);
        const { transactionId } = transaction;

        if (!transactionId) {
          throw new Error("No transaction ID found");
        }

        // Poll for status update (Callback might take a few seconds)
        let attempts = 0;
        const maxAttempts = 10;

        const poll = setInterval(async () => {
          attempts++;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let txnStatus = null;
          try {
            const status = await checkPaymentStatus(transactionId);

            if (status.status === 'SUCCESS') {
              txnStatus = 'SUCCESS';
            } else if (status.status === 'FAILED') {
              txnStatus = 'FAILED';
            }
          } catch (invokeError) {
            console.error('Error checking payment status:', invokeError);
            // Continue polling, don't fail immediately
          }


          if (txnStatus === 'SUCCESS') {
            clearInterval(poll);

            // Activate Subscription in Firestore
            try {
              const pendingData = localStorage.getItem('pendingTransaction');
              if (pendingData) {
                const { plan, billingCycle, userId } = JSON.parse(pendingData);
                if (userId && plan === 'pro') {
                  const now = new Date();
                  const expiresAt = new Date();
                  if (billingCycle === 'yearly') {
                    expiresAt.setFullYear(now.getFullYear() + 1);
                  } else {
                    expiresAt.setMonth(now.getMonth() + 1);
                  }

                  const subRef = doc(db, 'user_subscriptions', userId);
                  await updateDoc(subRef, {
                    plan_type: 'pro',
                    is_active: true,
                    billing_cycle: billingCycle,
                    updated_at: now.toISOString(),
                    expires_at: expiresAt.toISOString()
                  });
                }
              }
            } catch (dbError) {
              console.error("Failed to activate subscription:", dbError);
              // Don't fail the UI, as payment was successful. User can contact support.
            }

            setStatus('success');
            setMessage(isHindi
              ? 'आपका Revonn Pro प्लान सक्रिय हो गया है!'
              : 'Your Revonn Pro plan is now active!'
            );
            localStorage.removeItem('pendingTransaction');
            await refreshSubscription();
          } else if (txnStatus === 'FAILED') {
            clearInterval(poll);
            setStatus('failed');
            setMessage(isHindi ? 'भुगतान विफल' : 'Payment failed');
          } else if (attempts >= maxAttempts) {
            clearInterval(poll);
            // If still pending after timeout, show generic message or keep waiting
            // For now, we'll suggest checking back later or contact support if money deducted
            setStatus('failed');
            setMessage(isHindi ? 'भुगतान स्थिति अभी तक अपडेट नहीं हुई है.' : 'Payment status pending. Please check dashboard.');
          }
        }, 2000); // Check every 2 seconds

        return () => clearInterval(poll);

      } catch (error) {
        console.error('Payment verification error:', error);
        setStatus('failed');
        setMessage(isHindi ? 'भुगतान सत्यापन में त्रुटि' : 'Payment verification error');
      }
    };

    checkStatus();
  }, [location.state]);

  return (
    <AppLayout title={isHindi ? 'पेमेंट स्टेटस' : 'Payment Status'} hideNav>
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <Card className="p-8 text-center max-w-sm w-full">
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin mb-4" />
              <h2 className="text-xl font-bold mb-2">
                {isHindi ? 'भुगतान सत्यापित हो रहा है...' : 'Verifying payment...'}
              </h2>
              <p className="text-muted-foreground">
                {isHindi ? 'कृपया प्रतीक्षा करें' : 'Please wait'}
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 mx-auto bg-success/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-12 h-12 text-success" />
              </div>
              <h2 className="text-xl font-bold text-success mb-2">
                {isHindi ? 'भुगतान सफल!' : 'Payment Successful!'}
              </h2>
              <p className="text-muted-foreground mb-6">{message}</p>
              <Button
                onClick={() => navigate('/dashboard')}
                className="w-full btn-gold"
              >
                {isHindi ? 'डैशबोर्ड पर जाएं' : 'Go to Dashboard'}
              </Button>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="w-20 h-20 mx-auto bg-destructive/20 rounded-full flex items-center justify-center mb-4">
                <XCircle className="w-12 h-12 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-destructive mb-2">
                {isHindi ? 'भुगतान विफल' : 'Payment Failed'}
              </h2>
              <p className="text-muted-foreground mb-6">{message}</p>
              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/subscription')}
                  className="w-full"
                >
                  {isHindi ? 'पुनः प्रयास करें' : 'Try Again'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="w-full"
                >
                  {isHindi ? 'डैशबोर्ड पर जाएं' : 'Go to Dashboard'}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
