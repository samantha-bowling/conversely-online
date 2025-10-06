import { Button } from "@/components/ui/button";
import { Lightbulb, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ConnectionStatus } from "@/hooks/useRealtimeConnection";

interface ChatHeaderProps {
  roomStatus: string;
  connectionStatus: ConnectionStatus;
  onShowPrompt: () => void;
  onBlock: () => void;
  onEndChat: () => void;
}

export const ChatHeader = ({ 
  roomStatus,
  connectionStatus,
  onShowPrompt, 
  onBlock, 
  onEndChat 
}: ChatHeaderProps) => {
  const getConnectionBadge = () => {
    if (roomStatus === "ended") {
      return (
        <Badge variant="secondary" className="gap-1">
          <WifiOff className="w-3 h-3" aria-hidden="true" />
          Disconnected
        </Badge>
      );
    }

    switch (connectionStatus) {
      case "connected":
        return (
          <Badge variant="default" className="gap-1 bg-green-500 hover:bg-green-600">
            <Wifi className="w-3 h-3" aria-hidden="true" />
            Connected
          </Badge>
        );
      case "reconnecting":
        return (
          <Badge variant="secondary" className="gap-1 animate-pulse">
            <Wifi className="w-3 h-3" aria-hidden="true" />
            Reconnecting...
          </Badge>
        );
      case "offline":
        return (
          <Badge variant="destructive" className="gap-1">
            <WifiOff className="w-3 h-3" aria-hidden="true" />
            Offline
          </Badge>
        );
    }
  };

  return (
    <header className="border-b border-border p-4 flex items-center justify-between bg-card" role="banner">
      <div className="flex items-center gap-3">
        <div>
          <div className="font-bold">Anonymous</div>
          <div className="text-xs text-muted-foreground" role="status" aria-live="polite">
            {roomStatus === "ended" ? "Disconnected" : "Active"}
          </div>
        </div>
        <div role="status" aria-live="polite">
          {getConnectionBadge()}
        </div>
      </div>
      <nav className="flex gap-2" aria-label="Chat controls">
        <Button
          variant="ghost"
          size="sm"
          onClick={onShowPrompt}
          className="gap-2"
          disabled={roomStatus === "ended"}
          aria-label="Show conversation prompt"
        >
          <Lightbulb className="w-4 h-4" aria-hidden="true" />
          Prompt
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onBlock}
          disabled={roomStatus === "ended"}
          aria-label="Block user and end conversation"
        >
          Block
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onEndChat}
          disabled={roomStatus === "ended"}
          aria-label="End conversation"
        >
          End Chat
        </Button>
      </nav>
    </header>
  );
};
