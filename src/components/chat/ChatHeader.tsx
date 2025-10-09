import { Button } from "@/components/ui/button";
import { Lightbulb, Wifi, WifiOff, Shuffle, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/hooks/useRealtimeConnection";

interface ChatHeaderProps {
  roomStatus: string;
  connectionStatus: ConnectionStatus;
  partnerUsername: string;
  partnerAvatar: string;
  currentUsername?: string;
  currentAvatar?: string;
  isEndingChat?: boolean;
  onShowPrompt: () => void;
  onReport: () => void;
  onNewMatch: () => void;
  onEndChat: () => void;
}

export const ChatHeader = ({ 
  roomStatus,
  connectionStatus,
  partnerUsername,
  partnerAvatar,
  currentUsername = "You",
  currentAvatar = "👤",
  isEndingChat = false,
  onShowPrompt,
  onReport,
  onNewMatch,
  onEndChat 
}: ChatHeaderProps) => {
  const getConnectionBadgeClasses = () => {
    if (roomStatus === "ended") {
      return "bg-red-500/10 text-red-600 border-red-500/20";
    }

    switch (connectionStatus) {
      case "connected":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "partner_disconnected":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "reconnecting":
      case "offline":
        return "bg-red-500/10 text-red-600 border-red-500/20";
    }
  };

  const getConnectionText = () => {
    if (roomStatus === "ended") return "Disconnected";
    if (connectionStatus === "partner_disconnected") return "Partner Left";
    if (connectionStatus === "connected") return "Connected";
    return "Reconnecting";
  };

  return (
    <header className="z-10 relative border-b border-border px-4 py-3 bg-card flex items-center justify-between" role="banner">
      {/* Left: Single-line header */}
      <h2 className="font-semibold text-base">
        You ({currentAvatar} {currentUsername}) are chatting with ({partnerAvatar} {partnerUsername})
      </h2>
      
      {/* Right: All controls */}
      <nav className="flex items-center gap-2" aria-label="Chat controls">
        <Button
          variant="ghost"
          size="sm"
          onClick={onShowPrompt}
          disabled={roomStatus === "ended"}
          aria-label="Show conversation prompt"
        >
          <Lightbulb className="w-4 h-4 mr-1" aria-hidden="true" />
          Prompt
        </Button>
        
        {/* Connection Badge */}
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
            getConnectionBadgeClasses()
          )}
          role="status"
          aria-live="polite"
        >
          <Wifi className="w-3 h-3 mr-1" aria-hidden="true" />
          {getConnectionText()}
        </span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onNewMatch}
          disabled={roomStatus === "ended"}
          aria-label="Find new match"
        >
          <Shuffle className="w-4 h-4 mr-1" aria-hidden="true" />
          New Match
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onReport}
          disabled={roomStatus === "ended"}
          aria-label="Report user"
        >
          <Flag className="w-4 h-4 mr-1" aria-hidden="true" />
          Report
        </Button>
        
        <Button
          variant="destructive"
          size="sm"
          onClick={onEndChat}
          disabled={roomStatus === "ended" || isEndingChat}
          aria-label="End conversation"
        >
          {isEndingChat ? "Ending..." : "End Chat"}
        </Button>
      </nav>
    </header>
  );
};
