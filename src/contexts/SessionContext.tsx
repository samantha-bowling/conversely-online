import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
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
  initializeSession: () => Promise<boolean>;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const createNewSession = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[Session] Creating new guest session...');
      
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
        // Handle rate limiting
        if (error.message?.includes('Too many session requests')) {
          handleError(error, { 
            description: ERROR_MESSAGES.SESSION_RATE_LIMITED,
            logToConsole: true 
          });
        } else {
          handleError(error, { 
            description: ERROR_MESSAGES.SESSION_CREATE_ERROR,
            logToConsole: true 
          });
        }
        return false;
      }

      // Set Supabase auth session with anonymous user tokens
      if (data.auth_session) {
        const { error: authError } = await supabase.auth.setSession({
          access_token: data.auth_session.access_token,
          refresh_token: data.auth_session.refresh_token,
        });

        if (authError) {
          console.error('[Session] Auth session error:', authError);
          handleError(authError, { 
            description: ERROR_MESSAGES.SESSION_CREATE_ERROR,
            logToConsole: true 
          });
          return false;
        }
      }
      
      // Store guest session data (without auth tokens for security)
      const sessionData = {
        id: data.id,
        username: data.username,
        avatar: data.avatar,
        expires_at: data.expires_at,
      };
      
      localStorage.setItem('guest_session', JSON.stringify(sessionData));
      setSession(sessionData);
      
      console.log('[Session] Session created successfully:', {
        id: data.id,
        username: data.username,
        expires_at: data.expires_at
      });
      
      return true;
    } catch (error) {
      console.error('[Session] Unexpected error:', error);
      handleError(error, { 
        description: ERROR_MESSAGES.SESSION_CREATE_ERROR,
        logToConsole: true 
      });
      return false;
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

  const initializeSession = useCallback(async (): Promise<boolean> => {
    // Prevent concurrent calls
    if (isCreating) {
      console.log('[Session] Session creation already in progress');
      return false;
    }
    
    setIsCreating(true);
    setLoading(true);
    
    try {
      const success = await createNewSession();
      console.log('[Session] Initialize result:', success);
      return success;
    } catch (error) {
      console.error('[Session] Failed to initialize session:', error);
      return false;
    } finally {
      setLoading(false);
      setIsCreating(false);
    }
  }, [isCreating, createNewSession]);

  const refreshSession = useCallback(async () => {
    checkExistingSession();
  }, [checkExistingSession]);

  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

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
    <SessionContext.Provider value={{ session, loading, initializeSession, refreshSession }}>
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
