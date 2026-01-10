import { Sparkles } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';

export function AIFloatingButton() {
  const { isAIOpen, setIsAIOpen } = useAppStore();

  if (isAIOpen) return null;

  return (
    <button
      onClick={() => setIsAIOpen(true)}
      className={cn(
        "fixed bottom-24 right-4 z-40",
        "w-14 h-14 rounded-full",
        "gold-gradient shadow-xl",
        "flex items-center justify-center",
        "transition-all duration-300 hover:scale-110",
        "animate-bounce-slow"
      )}
      aria-label="Open AI Assistant"
    >
      <Sparkles className="w-6 h-6 text-primary-foreground" />
      {/* Pulse ring effect */}
      <span className="absolute inset-0 rounded-full gold-gradient animate-ping opacity-30" />
    </button>
  );
}
