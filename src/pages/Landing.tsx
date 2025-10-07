import { ConversationButton } from "@/components/ConversationButton";
import { useNavigate, Link } from "react-router-dom";
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

      {/* Footer */}
      <footer className="absolute bottom-4 left-0 right-0">
        <div className="text-center text-xs text-muted-foreground space-x-2">
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <span>•</span>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <span>•</span>
          <Link to="/privacy-requests" className="hover:text-foreground transition-colors">Privacy Requests</Link>
          <span>•</span>
          <Link to="/report" className="hover:text-foreground transition-colors">Report Abuse</Link>
        </div>
      </footer>
    </div>;
};
export default Landing;