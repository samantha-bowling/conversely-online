import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionProvider } from "./contexts/SessionContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import RequireSession from "@/components/RequireSession";
import Landing from "./pages/Landing";
import Survey from "./pages/Survey";
import Matching from "./pages/Matching";
import Chat from "./pages/Chat";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import DataRetention from "./pages/DataRetention";
import PrivacyRequests from "./pages/PrivacyRequests";
import Report from "./pages/Report";
import NotFound from "./pages/NotFound";

const App = () => (
  <SessionProvider>
    <TooltipProvider>
      <ErrorBoundary>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            
            {/* Protected routes - require valid session */}
            <Route element={<RequireSession />}>
              <Route path="/survey" element={<Survey />} />
              <Route path="/matching" element={<Matching />} />
              <Route path="/chat/:roomId" element={<Chat />} />
            </Route>
            
            {/* Public routes */}
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/data-retention" element={<DataRetention />} />
            <Route path="/privacy-requests" element={<PrivacyRequests />} />
            <Route path="/report" element={<Report />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </SessionProvider>
);

export default App;
