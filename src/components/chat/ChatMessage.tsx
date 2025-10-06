interface ChatMessageProps {
  sender: "me" | "other";
  text: string;
  fading?: boolean;
  remaining?: number;
}

export const ChatMessage = ({ sender, text, fading, remaining }: ChatMessageProps) => {
  const showCountdown = remaining !== undefined && remaining <= 10000;
  const secondsLeft = remaining ? Math.ceil(remaining / 1000) : 0;

  return (
    <div
      className={`flex ${sender === "me" ? "justify-end" : "justify-start"} ${
        fading ? "animate-fade-dissolve" : "animate-fade-in-gentle"
      }`}
      role="article"
      aria-label={`Message from ${sender === "me" ? "you" : "conversation partner"}`}
    >
      <div className="flex flex-col gap-1 max-w-[70%]">
        <div
          className={`rounded-lg p-3 ${
            sender === "me"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          <p className="text-sm">{text}</p>
        </div>
        {showCountdown && (
          <span 
            className="text-xs text-muted-foreground px-1"
            aria-live="polite"
          >
            Disappears in {secondsLeft}s
          </span>
        )}
      </div>
    </div>
  );
};
