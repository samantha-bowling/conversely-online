import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ConversationButton } from "@/components/ConversationButton";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { isMatchResponse } from "@/lib/validation";
import { handleError } from "@/lib/error-handler";
import { ERROR_MESSAGES, STATUS_MESSAGES, TIMING } from "@/config/constants";
import type { MatchOppositeResponse } from '@/types';

const Matching = () => {
  const navigate = useNavigate();
  const { session } = useSession();
  const [status, setStatus] = useState<"searching" | "found" | "not-found" | "cooldown" | "rate-limited">("searching");
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>(STATUS_MESSAGES.SEARCHING);

  useEffect(() => {
    const findMatch = async () => {
      if (!session) return;

      try {
        const { data, error } = await supabase.functions.invoke<MatchOppositeResponse>('match-opposite');

        if (error) throw error;

        if (!isMatchResponse(data)) {
          handleError(new Error('Invalid match response format'), { 
            showToast: false,
            logToConsole: true 
          });
          setStatus("not-found");
          return;
        }

        if (data.status === 'cooldown') {
          setStatus('cooldown');
          setWaitSeconds(data.wait_seconds || 0);
          setStatusAnnouncement(`Please wait ${data.wait_seconds || 0} seconds before trying again`);
        } else if (data.status === 'rate_limited') {
          setStatus('rate-limited');
          setWaitSeconds(data.retry_after || 60);
          setStatusAnnouncement(`Rate limited. Please wait ${data.retry_after || 60} seconds`);
        } else if (data.status === 'match_found' && data.room_id) {
          setStatus("found");
          setStatusAnnouncement(STATUS_MESSAGES.MATCH_FOUND);
          setTimeout(() => {
            navigate("/chat", { state: { room_id: data.room_id } });
          }, TIMING.MATCH_FOUND_REDIRECT);
        } else {
          setStatus("not-found");
          setStatusAnnouncement(STATUS_MESSAGES.NO_MATCH);
        }
      } catch (error) {
        handleError(error, { description: ERROR_MESSAGES.MATCH_ERROR });
        setStatus("not-found");
      }
    };

    const timeout = setTimeout(findMatch, TIMING.MATCHING_SEARCH_DELAY);
    return () => clearTimeout(timeout);
  }, [navigate, session]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-fade-in-gentle">
      {/* Screen reader announcements */}
      <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
        {statusAnnouncement}
      </div>
      
      <main className="max-w-md w-full text-center space-y-8" role="main">
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

        {status === "cooldown" && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Please wait</h2>
              <p className="text-muted-foreground">
                You can try matching again in {waitSeconds} seconds.
              </p>
            </div>

            <div className="pt-4">
              <ConversationButton
                variant="outline"
                onClick={() => navigate("/")}
              >
                Back to Home
              </ConversationButton>
            </div>
          </div>
        )}

        {status === "rate-limited" && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Slow down there!</h2>
              <p className="text-muted-foreground">
                You've tried matching too many times. Please wait {waitSeconds} seconds before trying again.
              </p>
            </div>

            <div className="pt-4">
              <ConversationButton
                variant="outline"
                onClick={() => navigate("/")}
              >
                Back to Home
              </ConversationButton>
            </div>
          </div>
        )}

        {status === "not-found" && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">No match found right now</h2>
              <p className="text-muted-foreground">
                We couldn't find someone with opposite views at the moment.
                This happens when the pool is small.
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
          </div>
        )}
      </main>
    </div>
  );
};

export default Matching;
