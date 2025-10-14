import { useState, useEffect, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionExpiryWarningProps {
  expiresAt: string;
  className?: string;
}

export function SessionExpiryWarning({ expiresAt, className }: SessionExpiryWarningProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const lastDismissedRef = useRef<number>(0);

  useEffect(() => {
    const updateTimer = () => {
      const expiryTime = new Date(expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000));
      
      setTimeRemaining(remaining);

      // Show warning when less than 5 minutes remaining
      const fiveMinutes = 5 * 60;
      if (remaining <= fiveMinutes && remaining > 0) {
        setShowWarning(true);
        
        // Re-show warning every 2 minutes if dismissed
        const timeSinceDismiss = now - lastDismissedRef.current;
        const twoMinutes = 2 * 60 * 1000;
        if (isDismissed && timeSinceDismiss >= twoMinutes) {
          setIsDismissed(false);
        }
      } else {
        setShowWarning(false);
      }
    };

    // Update immediately
    updateTimer();

    // Update every 10 seconds (avoid constant updates)
    const interval = setInterval(updateTimer, 10000);

    return () => clearInterval(interval);
  }, [expiresAt, isDismissed]);

  const handleDismiss = () => {
    setIsDismissed(true);
    lastDismissedRef.current = Date.now();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't render if dismissed, no time left, or not time to show warning
  if (isDismissed || !showWarning || timeRemaining === null || timeRemaining === 0) {
    return null;
  }

  return (
    <Alert 
      className={cn(
        "relative border-yellow-500/50 bg-yellow-500/10 text-foreground",
        className
      )}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
    >
      <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-500" aria-hidden="true" />
      <AlertDescription className="flex items-center justify-between gap-4 pr-8">
        <span className="text-sm">
          Session expires in <span className="font-semibold tabular-nums">{formatTime(timeRemaining)}</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="absolute right-2 top-2 h-6 w-6 p-0 hover:bg-yellow-500/20"
          aria-label="Dismiss session expiry warning"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
