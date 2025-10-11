import { ConnectionStatus } from "@/hooks/useChatRealtime";
import { AlertCircle, WifiOff, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConnectionStatusBannerProps {
  status: ConnectionStatus;
}

export const ConnectionStatusBanner = ({ status }: ConnectionStatusBannerProps) => {
  if (status === "connected") return null;

  return (
    <Alert 
      variant={status === "offline" ? "destructive" : "default"}
      className="rounded-none border-x-0 border-t-0"
    >
      {status === "offline" ? (
        <WifiOff className="h-4 w-4" />
      ) : (
        <RefreshCw className="h-4 w-4 animate-spin" />
      )}
      <AlertDescription>
        {status === "offline" 
          ? "Connection lost. Attempting to reconnect..." 
          : "Reconnecting to chat..."}
      </AlertDescription>
    </Alert>
  );
};
