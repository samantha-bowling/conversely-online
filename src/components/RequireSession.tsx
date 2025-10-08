import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { Loader2 } from 'lucide-react';

/**
 * Route guard that ensures a valid session exists before rendering protected routes.
 * Three-state logic: loading → show spinner, no session → redirect home, has session → render children.
 */
export default function RequireSession() {
  const { session, loading } = useSession();
  const location = useLocation();

  // State 1: Loading - show accessible spinner
  if (loading) {
    return (
      <div 
        className="flex h-screen items-center justify-center"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading session...</span>
      </div>
    );
  }

  // State 2: No session - redirect to home (save from location for potential future use)
  if (!session) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  // State 3: Has session - render protected routes
  return <Outlet />;
}
