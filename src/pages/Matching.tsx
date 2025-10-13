import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ConversationButton } from "@/components/ConversationButton";
import { ActivityIndicator } from "@/components/ActivityIndicator";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { isMatchResponse } from "@/lib/validation";
import { handleError } from "@/lib/error-handler";
import { ERROR_MESSAGES, STATUS_MESSAGES, TIMING } from "@/config/constants";
import type { MatchOppositeResponse, ActivityLevel } from '@/types';

const Matching = () => {
  const navigate = useNavigate();
  const { session } = useSession();
  const [status, setStatus] = useState<"searching" | "found" | "not-found" | "cooldown" | "rate-limited">("searching");
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>(STATUS_MESSAGES.SEARCHING);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [checkingActivity, setCheckingActivity] = useState(false);
  const [retryEnabled, setRetryEnabled] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [presenceReady, setPresenceReady] = useState(false);
  const [matchAttempts, setMatchAttempts] = useState(0);
  const [isMatching, setIsMatching] = useState(false);
  const targetEndTimeRef = useRef<number | null>(null);
  const setupStartTimeRef = useRef<number>(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const presenceChannelRef = useRef<any>(null);

  // Hybrid presence system: Realtime channel + SQL heartbeat
  useEffect(() => {
    if (!session?.id) return;

    let cancelled = false;

    const setupPresence = async () => {
      setupStartTimeRef.current = Date.now();
      console.log('[Presence] Starting setup at', setupStartTimeRef.current);

      try {
        // 1. Mark as searching + initial heartbeat (atomic operation)
        const { error: updateError } = await supabase
          .from('guest_sessions')
          .update({ 
            is_searching: true, 
            last_heartbeat_at: new Date().toISOString() 
          })
          .eq('id', session.id);

        if (updateError) throw updateError;
        console.log('[Presence] DB flags set at', Date.now() - setupStartTimeRef.current, 'ms');

        // 2. Subscribe to Realtime presence channel
        const channel = supabase.channel(`presence:matching:${session.id}`, {
          config: { presence: { key: session.id } }
        });

        channel.on('presence', { event: 'sync' }, () => {
          console.log('[Presence] Channel sync');
        });

        // Wait for subscription to complete
        await new Promise<void>((resolve, reject) => {
          channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await channel.track({ 
                userId: session.id, 
                searching: true, 
                timestamp: Date.now() 
              });
              console.log('[Presence] Channel subscribed at', Date.now() - setupStartTimeRef.current, 'ms');
              resolve();
            } else if (status === 'CHANNEL_ERROR') {
              reject(new Error('Channel subscription failed'));
            }
          });
        });

        presenceChannelRef.current = channel;

        // 3. Start SQL heartbeat fallback (every 15s)
        heartbeatIntervalRef.current = setInterval(async () => {
          try {
            await supabase
              .from('guest_sessions')
              .update({ last_heartbeat_at: new Date().toISOString() })
              .eq('id', session.id);
            console.log('[Heartbeat] Sent at', new Date().toISOString());
          } catch (error) {
            console.error('[Heartbeat] Error:', error);
          }
        }, 15000);

        // ✅ SIGNAL READY - All async operations complete
        if (!cancelled) {
          const totalSetupTime = Date.now() - setupStartTimeRef.current;
          console.log('[Presence] ✅ Setup complete in', totalSetupTime, 'ms');
          setPresenceReady(true);
        }

      } catch (error) {
        console.error('[Presence] Setup failed:', error);
        // Fallback: still allow matching after 3s even if presence fails
        if (!cancelled) {
          setTimeout(() => setPresenceReady(true), 3000);
        }
      }
    };

    setupPresence();

    // Cleanup
    return () => {
      cancelled = true;
      console.log('[Presence] Cleaning up');
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack();
        supabase.removeChannel(presenceChannelRef.current);
      }

      if (session?.id) {
        supabase
          .from('guest_sessions')
          .update({ is_searching: false })
          .eq('id', session.id)
          .then(() => console.log('[Presence] Marked as not searching'));
      }
    };
  }, [session?.id]);

  // Conditional match trigger - only starts after presence is ready
  useEffect(() => {
    // ⏸️ Wait for presence to be ready
    if (!presenceReady || !session) return;

    const startMatching = async () => {
      if (isMatching) {
        console.log('[Matching] Already in progress, skipping');
        return;
      }

      setIsMatching(true);
      const matchStartTime = Date.now();
      console.log('[Timing] Match attempt started at', matchStartTime, '(setup took', matchStartTime - setupStartTimeRef.current, 'ms)');

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

        console.log('[Matching] Response:', data.status, 'in', Date.now() - matchStartTime, 'ms');

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
          console.log('[Matching] ✅ Match found, redirecting to room', data.room_id);
          setTimeout(() => {
            navigate(`/chat/${data.room_id}`);
          }, TIMING.MATCH_FOUND_REDIRECT);
        } else if (data.status === 'no_match') {
          setMatchAttempts(prev => prev + 1);
          
          // 🔄 Auto-retry once after 2s (handles DB propagation lag)
          if (matchAttempts === 0) {
            console.log('[Matching] No match on first attempt, retrying in 2s...');
            setTimeout(() => {
              setIsMatching(false);
              startMatching();
            }, 2000);
          } else {
            console.log('[Matching] No match after retry');
            setStatus("not-found");
            setStatusAnnouncement(STATUS_MESSAGES.NO_MATCH);
          }
        } else {
          setStatus("not-found");
          setStatusAnnouncement(STATUS_MESSAGES.NO_MATCH);
        }
      } catch (error) {
        handleError(error, { description: ERROR_MESSAGES.MATCH_ERROR });
        setStatus("not-found");
      } finally {
        // Debounce cooldown (prevent rapid re-calls)
        setTimeout(() => setIsMatching(false), 1000);
      }
    };

    // Start matching after a brief delay to ensure presence fully propagated
    const timeout = setTimeout(startMatching, 500);
    return () => clearTimeout(timeout);
  }, [presenceReady, session, navigate, matchAttempts, isMatching]);

  // Countdown timer effect - timestamp-based for resilience to tab throttling
  useEffect(() => {
    if (status !== 'cooldown' && status !== 'rate-limited') {
      targetEndTimeRef.current = null;
      setRetryEnabled(false);
      return;
    }

    if (waitSeconds <= 0) {
      setRetryEnabled(true);
      return;
    }

    // Calculate absolute target time (resilient to tab throttling)
    targetEndTimeRef.current = Date.now() + (waitSeconds * 1000);

    const interval = setInterval(() => {
      if (!targetEndTimeRef.current) {
        clearInterval(interval);
        return;
      }

      const remaining = Math.max(0, Math.floor((targetEndTimeRef.current - Date.now()) / 1000));
      setWaitSeconds(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        setRetryEnabled(true);
        setStatusAnnouncement('You can now try matching again');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

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

  const handleRetryMatch = async () => {
    if (isRetrying) return;
    
    setIsRetrying(true);
    setRetryEnabled(false);
    
    setTimeout(() => {
      setIsRetrying(false);
      navigate('/survey');
    }, 1000);
  };

  const formatTime = (seconds: number): string => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  };

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
                {retryEnabled ? (
                  <span className="text-primary font-semibold animate-pulse">
                    Ready to match again!
                  </span>
                ) : (
                  <>You can try matching again in <span className="font-semibold">{formatTime(waitSeconds)}</span></>
                )}
              </p>
            </div>

            <div className="pt-4 space-y-3">
              {retryEnabled && (
                <ConversationButton
                  variant="primary"
                  onClick={handleRetryMatch}
                  disabled={isRetrying}
                >
                  {isRetrying ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Starting...
                    </span>
                  ) : (
                    'Try Matching Again'
                  )}
                </ConversationButton>
              )}
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
                {retryEnabled ? (
                  <span className="text-primary font-semibold animate-pulse">
                    Ready to match again!
                  </span>
                ) : (
                  <>You've tried matching too many times. Please wait <span className="font-semibold">{formatTime(waitSeconds)}</span> before trying again.</>
                )}
              </p>
            </div>

            <div className="pt-4 space-y-3">
              {retryEnabled && (
                <ConversationButton
                  variant="primary"
                  onClick={handleRetryMatch}
                  disabled={isRetrying}
                >
                  {isRetrying ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Starting...
                    </span>
                  ) : (
                    'Try Matching Again'
                  )}
                </ConversationButton>
              )}
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
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">No match found right now</h2>
              <p className="text-muted-foreground">
                Nobody's available at the moment. Check back again soon!
              </p>
              
              <div className="flex justify-center pt-2">
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
                  <ActivityIndicator activityLevel={activityLevel} variant="full" />
                )}
              </div>
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
