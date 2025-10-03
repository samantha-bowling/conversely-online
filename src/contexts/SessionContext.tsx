import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  const createNewSession = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-guest-session');
      
      if (error) {
        console.error('Error creating session:', error);
        
        // Handle rate limiting
        if (error.message?.includes('Too many session requests')) {
          console.warn('Session creation rate limited');
          // Still try to continue with a degraded experience
        }
        return;
      }
      
      localStorage.setItem('guest_session', JSON.stringify(data));
      setSession(data);
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const refreshSession = async () => {
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
  };

  useEffect(() => {
    refreshSession();
  }, []);

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
