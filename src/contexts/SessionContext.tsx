import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/error-handler";
import { ERROR_MESSAGES } from "@/config/constants";
import { toast } from "sonner";
import type { CreateSessionResponse } from '@/types';

interface Session {
  id: string;
  username: string;
  avatar: string;
  expires_at: string;
}

interface SessionContextType {
  session: Session | null;
  loading: boolean;
  ensureAnonAuth: () => Promise<void>;
  initializeSession: () => Promise<Session>;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Module-level state for de-duplication and generation guard
let inFlightSession: Promise<Session> | null = null;
let generationCounter = 0;

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  /**
   * Ensure anonymous auth session exists (no-op if already signed in)
   */
  const ensureAnonAuth = useCallback(async (): Promise<void> => {
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    
    if (existingSession?.user) {
      console.log('[Session] Auth already exists:', existingSession.user.id);
      return;
    }

    console.log('[Session] Creating anonymous auth session...');
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    
    if (authError || !authData.user || !authData.session) {
      console.error('[Session] Anonymous auth error:', authError);
      throw authError || new Error('Failed to create anonymous session');
    }
    
    console.log('[Session] Auth session created, user_id:', authData.user.id);
  }, []);

  /**
   * Create a new guest session with generation guard and in-flight de-duplication
   */
  const createNewSession = useCallback(async (): Promise<Session> => {
    // De-duplication: return existing promise if session creation is in-flight
    if (inFlightSession) {
      console.log('[Session] Session creation already in progress, returning existing promise');
      return inFlightSession;
    }

    const myGeneration = ++generationCounter;
    console.log('[Session] Starting session creation (generation:', myGeneration, ')');

    inFlightSession = (async (): Promise<Session> => {
      const start = performance.now();

      try {
        // Call edge function - JWT is automatically included in Authorization header
        const { data, error } = await supabase.functions.invoke<CreateSessionResponse>(
          'create-guest-session',
          {
            headers: {
              'x-consent-given': 'true'
            }
          }
        );
        
        if (error) {
          console.error('[Session] Edge function error:', error);
          if (error.message?.includes('Too many session requests')) {
            throw new Error(ERROR_MESSAGES.SESSION_RATE_LIMITED);
          } else {
            throw new Error(ERROR_MESSAGES.SESSION_CREATE_ERROR);
          }
        }
        
        const sessionData: Session = {
          id: data.id,
          username: data.username,
          avatar: data.avatar,
          expires_at: data.expires_at,
        };

        // Generation guard: only update state if this is still the current generation
        if (myGeneration === generationCounter) {
          setSession(sessionData);
          try {
            localStorage.setItem('guest_session', JSON.stringify(sessionData));
          } catch (storageError) {
            console.warn('[Session] Failed to persist to localStorage:', storageError);
          }

          const duration = (performance.now() - start).toFixed(0);
          console.log(`[Session] Session created successfully (${duration}ms):`, {
            id: data.id,
            username: data.username,
            generation: myGeneration
          });
        } else {
          console.log('[Session] Stale generation', myGeneration, 'current:', generationCounter, '- discarding');
        }

        return sessionData;
      } catch (error) {
        console.error('[Session] Session creation failed:', error);
        throw error;
      }
    })();

    try {
      return await inFlightSession;
    } finally {
      inFlightSession = null;
    }
  }, []);

  const checkExistingSession = useCallback(() => {
    const stored = localStorage.getItem('guest_session');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (new Date(parsed.expires_at) > new Date()) {
        setSession(parsed);
      }
    }
  }, []);

  /**
   * Initialize a new session (public API for components)
   * Returns the session object and updates context state
   */
  const initializeSession = useCallback(async (): Promise<Session> => {
    if (loadingRef.current) {
      console.log('[Session] Session initialization already in progress');
      if (inFlightSession) return inFlightSession;
      throw new Error('Session initialization in progress');
    }
    
    loadingRef.current = true;
    setLoading(true);
    
    try {
      const sessionData = await createNewSession();
      return sessionData;
    } catch (error) {
      console.error('[Session] Failed to initialize session:', error);
      handleError(error, { 
        description: error instanceof Error ? error.message : ERROR_MESSAGES.SESSION_CREATE_ERROR,
        logToConsole: true 
      });
      throw error;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [createNewSession]);

  const refreshSession = useCallback(async () => {
    checkExistingSession();
  }, [checkExistingSession]);

  // Set up auth state listener first, then check existing session
  useEffect(() => {
    console.log('[Session] Setting up auth state listener');
    
    // Auth state listener for token refresh and sign out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, authSession) => {
      console.log('[Session] Auth state changed:', event);
      
      if (event === 'SIGNED_OUT') {
        console.log('[Session] User signed out, clearing session');
        setSession(null);
        localStorage.removeItem('guest_session');
      } else if (event === 'TOKEN_REFRESHED' && authSession?.user) {
        console.log('[Session] Token refreshed for user:', authSession.user.id);
        // Session state is still valid, no action needed
      }
    });

    // Then check for existing session
    checkExistingSession();

    return () => {
      console.log('[Session] Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, [checkExistingSession]);

  // Multi-tab sync: listen for storage changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'guest_session') {
        if (e.newValue === null) {
          // Session removed in another tab
          console.log('[Session] Session removed in another tab');
          setSession(null);
        } else if (e.newValue) {
          // Session updated in another tab
          try {
            const parsed = JSON.parse(e.newValue);
            if (new Date(parsed.expires_at) > new Date()) {
              console.log('[Session] Session updated from another tab');
              setSession(parsed);
            }
          } catch (error) {
            console.error('[Session] Failed to parse storage event:', error);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Monitor session expiry
  useEffect(() => {
    if (!session?.expires_at) return;

    const expiryTime = new Date(session.expires_at).getTime();
    const checkExpiry = () => {
      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;

      if (timeUntilExpiry <= 0) {
        toast.error("Your session has expired");
        localStorage.removeItem("guest_session");
        setSession(null);
        refreshSession();
      }
    };

    // Check immediately
    checkExpiry();

    // Check every minute
    const interval = setInterval(checkExpiry, 60000);

    return () => clearInterval(interval);
  }, [session?.expires_at, refreshSession]);

  return (
    <SessionContext.Provider value={{ session, loading, ensureAnonAuth, initializeSession, refreshSession }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
