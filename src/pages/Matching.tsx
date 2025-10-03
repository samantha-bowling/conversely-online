import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ConversationButton } from "@/components/ConversationButton";

const Matching = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const answers = location.state?.answers || {};
  const [status, setStatus] = useState<"searching" | "found" | "not-found">("searching");

  useEffect(() => {
    // Simulate matching logic
    const timer = setTimeout(() => {
      // For MVP, randomly show "found" or "not-found"
      const hasMatch = Math.random() > 0.3;
      setStatus(hasMatch ? "found" : "not-found");
      
      if (hasMatch) {
        // Navigate to chat after brief delay
        setTimeout(() => {
          navigate("/chat", { state: { answers } });
        }, 1500);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate, answers]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-fade-in-gentle">
      <div className="max-w-md w-full text-center space-y-8">
        {status === "searching" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Finding your match</h2>
              <p className="text-muted-foreground">
                Looking for someone with opposite views...
              </p>
            </div>
          </>
        )}

        {status === "found" && (
          <>
            <div className="w-16 h-16 bg-primary rounded-full mx-auto flex items-center justify-center">
              <svg
                className="w-8 h-8 text-primary-foreground"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Match found!</h2>
              <p className="text-muted-foreground">
                Connecting you to the conversation...
              </p>
            </div>
          </>
        )}

        {status === "not-found" && (
          <>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">No matches right now</h2>
              <p className="text-muted-foreground leading-relaxed">
                We couldn't find someone with opposite views available at the moment. 
                This happens during quiet times.
              </p>
            </div>
            <div className="space-y-3 pt-4">
              <ConversationButton
                variant="primary"
                onClick={() => navigate("/survey")}
              >
                Try Again
              </ConversationButton>
              <ConversationButton
                variant="outline"
                onClick={() => navigate("/")}
              >
                Back to Home
              </ConversationButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Matching;
