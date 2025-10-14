import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Lightbulb, Wifi, Shuffle, Flag, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/hooks/useChatRealtime";

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
    <header className="z-10 relative border-b border-border px-3 md:px-4 py-3 bg-card" role="banner">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        {/* Left: Connection status + Username */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          {/* Connection Badge */}
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap",
              getConnectionBadgeClasses()
            )}
            role="status"
            aria-live="polite"
            aria-label={getConnectionText()}
          >
            <Wifi className="w-3 h-3 mr-1" aria-hidden="true" />
            <span className="hidden sm:inline">{getConnectionText()}</span>
          </span>
          
          {/* Usernames */}
          <div className="min-w-0 flex-1">
            {/* Mobile: Compact */}
            <h2 className="font-semibold text-sm md:hidden truncate">
              You & {partnerUsername}
            </h2>
            
            {/* Desktop: Full */}
            <h2 className="hidden md:block font-semibold text-base truncate">
              You ({currentAvatar} {currentUsername}) ↔ ({partnerAvatar} {partnerUsername})
            </h2>
          </div>
        </div>
        
        {/* Right: Action controls */}
        <nav className="flex items-center gap-1.5 md:gap-2 flex-shrink-0" aria-label="Chat controls">
          {/* Prompt - Frequent action */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowPrompt}
            disabled={roomStatus === "ended"}
            aria-label="Show conversation prompt"
            className="h-9"
          >
            <Lightbulb className="w-4 h-4 md:mr-1.5" aria-hidden="true" />
            <span className="hidden md:inline">Prompt</span>
          </Button>
          
          {/* More actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={roomStatus === "ended"}
                aria-label="More actions"
                className="h-9 w-9 p-0"
              >
                <MoreVertical className="w-4 h-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onNewMatch} disabled={roomStatus === "ended"}>
                <Shuffle className="w-4 h-4 mr-2" aria-hidden="true" />
                New Match
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onReport} disabled={roomStatus === "ended"}>
                <Flag className="w-4 h-4 mr-2" aria-hidden="true" />
                Report User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* End Chat - Primary destructive action */}
          <Button
            variant="destructive"
            size="sm"
            onClick={onEndChat}
            disabled={roomStatus === "ended" || isEndingChat}
            aria-label="End conversation"
            className="h-9"
          >
            <span className="hidden sm:inline">{isEndingChat ? "Ending..." : "End"}</span>
            <span className="sm:hidden">End</span>
          </Button>
        </nav>
      </div>
    </header>
  );
};
