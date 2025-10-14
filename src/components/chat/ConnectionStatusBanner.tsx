import { useState, useEffect } from "react";
import { ConnectionStatus } from "@/hooks/useChatRealtime";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface ConnectionStatusBannerProps {
  status: ConnectionStatus;
  attemptCount?: number;
  sessionExpiryMinutesRemaining?: number;
}

export const ConnectionStatusBanner = ({ 
  status, 
  attemptCount = 0,
  sessionExpiryMinutesRemaining 
}: ConnectionStatusBannerProps) => {
  const [prevStatus, setPrevStatus] = useState<ConnectionStatus>(status);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Priority: defer to session expiry warning if < 5 mins
  if (sessionExpiryMinutesRemaining !== undefined && sessionExpiryMinutesRemaining < 5) {
    return null;
  }

  // Show success toast on reconnect
  useEffect(() => {
    if (prevStatus !== "connected" && status === "connected" && !showSuccessToast) {
      setShowSuccessToast(true);
      toast.success("Connected", {
        description: "Your connection has been restored",
        duration: 2000,
      });
      
      // Reset toast flag after showing
      const timeout = setTimeout(() => setShowSuccessToast(false), 2000);
      return () => clearTimeout(timeout);
    }
    setPrevStatus(status);
  }, [status, prevStatus, showSuccessToast]);

  // Don't show banner when connected
  if (status === "connected") return null;

  const getMessage = () => {
    if (status === "offline") {
      return attemptCount > 0 
        ? `Connection lost. Reconnecting (attempt ${attemptCount})...`
        : "Connection lost. Attempting to reconnect...";
    }
    
    if (status === "partner_disconnected") {
      return "Your conversation partner has disconnected";
    }
    
    return "Reconnecting to chat...";
  };

  const getIcon = () => {
    if (status === "offline") return <WifiOff className="h-4 w-4" />;
    if (status === "partner_disconnected") return <WifiOff className="h-4 w-4" />;
    return <RefreshCw className="h-4 w-4 animate-spin" />;
  };

  const getVariant = () => {
    if (status === "offline" || status === "partner_disconnected") return "destructive";
    return "default";
  };

  return (
    <Alert 
      variant={getVariant()}
      className="rounded-none border-x-0 border-t-0 animate-fade-in"
    >
      {getIcon()}
      <AlertDescription>{getMessage()}</AlertDescription>
    </Alert>
  );
};
