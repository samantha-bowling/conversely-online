import { ConversationButton } from "@/components/ConversationButton";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-fade-in-gentle">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo placeholder - will add actual logo */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold mb-2">Conversely</h1>
          <div className="h-1 w-24 bg-primary mx-auto rounded-full" />
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">
            Talk with someone who sees things differently
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Short, anonymous conversations with people who have opposite viewpoints. 
            No accounts. No history. Just a moment to understand.
          </p>
        </div>

        <div className="pt-8">
          <ConversationButton
            variant="primary"
            onClick={() => navigate("/survey")}
          >
            Start a Conversation
          </ConversationButton>
        </div>

        <p className="text-sm text-muted-foreground pt-4">
          Takes less than 5 minutes
        </p>
      </div>
    </div>
  );
};

export default Landing;
