import { useState, useEffect } from "react";
import { ConversationButton } from "@/components/ConversationButton";
import { ActivityIndicator } from "@/components/ActivityIndicator";
import { useNavigate, useLocation } from "react-router-dom";
import { AgeGate } from "@/components/AgeGate";
import { hasSeenAgeGate, needsReAcceptance } from "@/utils/legalAcceptance";
import converselyBanner from "@/assets/conversely-banner-transparent.png";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import type { ActivityLevel } from "@/types";

const Landing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [needsLegalUpdate, setNeedsLegalUpdate] = useState(false);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [checkingActivity, setCheckingActivity] = useState(false);
  
  // Detect test mode from URL
  const isTestMode = location.search.includes('test=true');

  // Store test mode flag in localStorage for persistence
  useEffect(() => {
    if (isTestMode) {
      localStorage.setItem('test_mode', 'true');
      console.log('[Test Mode] Active - sessions will be marked as test');
    }
  }, [isTestMode]);

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
  return <div className={`min-h-screen flex flex-col items-center justify-between p-4 pb-20 sm:pb-8 animate-fade-in-gentle ${isTestMode ? 'pt-14' : ''}`}>
      {isTestMode && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-100 dark:bg-yellow-900 border-b border-yellow-400 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 text-center py-2 text-sm font-semibold z-50 shadow-sm">
          🧪 TEST MODE — Safe Development Environment
        </div>
      )}
      
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="max-w-md w-full space-y-8 text-center">
        <div className="mb-8">
          <img 
            src={converselyBanner} 
            alt="Conversely - Talk with someone unlike you" 
            className="max-w-[336px] w-full mx-auto"
            loading="eager"
            fetchPriority="high"
            width={336}
            height={120}
            onLoad={() => console.log('Banner loaded successfully')}
            onError={(e) => {
              console.error('Banner failed to load');
              e.currentTarget.style.display = 'none';
              const fallback = document.createElement('h1');
              fallback.textContent = 'Conversely';
              fallback.className = 'text-4xl font-bold';
              e.currentTarget.parentElement?.appendChild(fallback);
            }}
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">
            Talk with someone who sees things differently
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">Short, anonymous conversations with people who are unlike you. No accounts. No history. Just a moment to converse.</p>
        </div>

        <div className="pt-8 space-y-4">
          <ConversationButton variant="primary" onClick={handleStartClick}>
            Start a Conversation
          </ConversationButton>

          {!activityLevel ? (
            <button
              onClick={checkActivity}
              disabled={checkingActivity}
              className="text-sm font-bold underline hover:no-underline text-foreground/80 hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkingActivity ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking...
                </span>
              ) : (
                'Check Activity'
              )}
            </button>
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
      </div>

      {/* Footer */}
      <footer className="w-full pb-4">
        <Footer variant="default" />
      </footer>

      {/* Age Gate Modal */}
      <AgeGate 
        open={showAgeGate} 
        onAccept={() => setShowAgeGate(false)} 
        onClose={() => setShowAgeGate(false)}
        needsLegalUpdate={needsLegalUpdate}
      />
    </div>;
};
export default Landing;