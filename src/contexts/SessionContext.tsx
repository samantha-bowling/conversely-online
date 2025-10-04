import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/error-handler";
import { ERROR_MESSAGES } from "@/config/constants";
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
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const createNewSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke<CreateSessionResponse>('create-guest-session');
      
      if (error) {
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
        return;
      }
      
      localStorage.setItem('guest_session', JSON.stringify(data));
      setSession(data);
    } catch (error) {
      handleError(error, { 
        description: ERROR_MESSAGES.SESSION_CREATE_ERROR,
        logToConsole: true 
      });
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const stored = localStorage.getItem('guest_session');
    
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Check if expired
      if (new Date(parsed.expires_at) > new Date()) {
        setSession(parsed);
        setLoading(false);
        return;
      }
    }
    
    await createNewSession();
    setLoading(false);
  }, [createNewSession]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  return (
    <SessionContext.Provider value={{ session, loading, refreshSession }}>
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
