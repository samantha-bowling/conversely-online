import { useState } from "react";
import { ConversationButton } from "@/components/ConversationButton";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import { AgeGate } from "@/components/AgeGate";
import { hasSeenAgeGate, needsReAcceptance } from "@/utils/legalAcceptance";
import converselyBanner from "@/assets/conversely-banner-transparent.png";
import { Footer } from "@/components/Footer";

const Landing = () => {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [needsLegalUpdate, setNeedsLegalUpdate] = useState(false);

  const handleStartClick = () => {
    const needsUpdate = needsReAcceptance();
    if (!hasSeenAgeGate() || needsUpdate) {
      setShowAgeGate(true);
      setNeedsLegalUpdate(needsUpdate);
    } else {
      navigate("/survey");
    }
  };
  return <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-fade-in-gentle">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="mb-8">
          <img src={converselyBanner} alt="Conversely" className="max-w-[336px] w-full mx-auto" />
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">
            Talk with someone who sees things differently
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">Short, anonymous conversations with people who are unlike you. No accounts. No history. Just a moment to converse.</p>
        </div>

        <div className="pt-8">
          <ConversationButton variant="primary" onClick={handleStartClick} disabled={loading || !session}>
            {loading ? "Preparing..." : "Start a Conversation"}
          </ConversationButton>
        </div>

        <p className="text-sm text-muted-foreground pt-4">
          Takes less than 5 minutes
        </p>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-4 left-0 right-0">
        <Footer variant="default" />
      </footer>

      {/* Age Gate Modal */}
      <AgeGate 
        open={showAgeGate} 
        onAccept={() => {
          setShowAgeGate(false);
          navigate("/survey");
        }} 
        onClose={() => setShowAgeGate(false)}
        needsLegalUpdate={needsLegalUpdate}
      />
    </div>;
};
export default Landing;