import React from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Crown } from 'lucide-react';

export const DemoBadge: React.FC = () => {
  const { subscription, isDemo, isPro, hasAI } = useSubscription();

  if (!subscription) return null;

  if (isDemo) {
    return (
      <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
        Demo Mode
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="secondary" 
        className={isPro 
          ? "bg-violet-500/10 text-violet-600 border-violet-500/30" 
          : "bg-blue-500/10 text-blue-600 border-blue-500/30"
        }
      >
        {isPro ? <Crown className="h-3 w-3 mr-1" /> : null}
        {subscription.plan_type === 'pro' ? 'Pro' : 'Basic'}
      </Badge>
      {hasAI && (
        <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
          <Sparkles className="h-3 w-3 mr-1" />
          AI
        </Badge>
      )}
    </div>
  );
};

export default DemoBadge;
