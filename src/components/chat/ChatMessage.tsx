interface ChatMessageProps {
  sender: "me" | "other";
  text: string;
  fading?: boolean;
}

export const ChatMessage = ({ sender, text, fading }: ChatMessageProps) => {
  return (
    <div
      className={`flex ${sender === "me" ? "justify-end" : "justify-start"} ${
        fading ? "animate-fade-dissolve" : "animate-fade-in-gentle"
      }`}
      role="article"
      aria-label={`Message from ${sender === "me" ? "you" : "conversation partner"}`}
    >
      <div
        className={`max-w-[70%] rounded-lg p-3 ${
          sender === "me"
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        }`}
      >
        <p className="text-sm">{text}</p>
      </div>
    </div>
  );
};
