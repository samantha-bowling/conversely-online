import { ConversationButton } from "@/components/ConversationButton";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import converselyBanner from "@/assets/conversely-banner-transparent.png";
const Landing = () => {
  const navigate = useNavigate();
  const {
    session,
    loading
  } = useSession();
  return <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-fade-in-gentle">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="mb-8">
          <img src={converselyBanner} alt="Conversely" className="max-w-[336px] w-full mx-auto" />
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">
            Talk with someone who sees things differently
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">Short, anonymous conversations with people who have opposite viewpoints. No accounts. No history. Just a moment to converse.</p>
        </div>

        <div className="pt-8">
          <ConversationButton variant="primary" onClick={() => navigate("/survey")} disabled={loading || !session}>
            {loading ? "Preparing..." : "Start a Conversation"}
          </ConversationButton>
        </div>

        <p className="text-sm text-muted-foreground pt-4">
          Takes less than 5 minutes
        </p>
      </div>
    </div>;
};
export default Landing;