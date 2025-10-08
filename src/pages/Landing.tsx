import { useState } from "react";
import { ConversationButton } from "@/components/ConversationButton";
import { ActivityIndicator } from "@/components/ActivityIndicator";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import { AgeGate } from "@/components/AgeGate";
import { hasSeenAgeGate, needsReAcceptance } from "@/utils/legalAcceptance";
import converselyBanner from "@/assets/conversely-banner-transparent.png";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import type { ActivityLevel } from "@/types";

const Landing = () => {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [needsLegalUpdate, setNeedsLegalUpdate] = useState(false);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [checkingActivity, setCheckingActivity] = useState(false);

  const handleStartClick = () => {
    const needsUpdate = needsReAcceptance();
    if (!hasSeenAgeGate() || needsUpdate) {
      setShowAgeGate(true);
      setNeedsLegalUpdate(needsUpdate);
    } else {
      navigate("/survey");
    }
  };

  const checkActivity = async () => {
    setCheckingActivity(true);
    try {
      const { data, error } = await supabase.functions.invoke<ActivityLevel>('get-activity-level');
      if (error) throw error;
      if (data) {
        setActivityLevel(data);
      }
    } catch (error) {
      console.error('Error checking activity:', error);
    } finally {
      setCheckingActivity(false);
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

        <div className="pt-8 space-y-4">
          <ConversationButton variant="primary" onClick={handleStartClick} disabled={loading || !session}>
            {loading ? "Preparing..." : "Start a Conversation"}
          </ConversationButton>

          {!activityLevel ? (
            <ConversationButton
              variant="outline"
              onClick={checkActivity}
              disabled={checkingActivity}
            >
              {checkingActivity ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Checking...
                </>
              ) : (
                'Check Activity'
              )}
            </ConversationButton>
          ) : (
            <div className="flex justify-center">
              <ActivityIndicator activityLevel={activityLevel} variant="full" />
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            Takes less than 5 minutes
          </p>
        </div>
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