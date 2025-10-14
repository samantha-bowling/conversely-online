import { useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { announce } from "@/lib/announce";

export default function SessionExpired() {
  const navigate = useNavigate();
  const location = useLocation();
  const context = location.state as { wasInChat?: boolean; wasMatching?: boolean; timestamp?: number } | null;

  useEffect(() => {
    announce("Your session has expired. Please start a new session to continue.", "assertive");
  }, []);

  const handleStartNew = () => {
    // Clear any stale data before starting fresh
    localStorage.removeItem("guest_session");
    navigate("/survey");
  };

  const handleReturnHome = () => {
    navigate("/");
  };

  const getContextMessage = () => {
    if (context?.wasInChat) {
      return "Your chat session has ended due to the 24-hour time limit.";
    }
    if (context?.wasMatching) {
      return "Your matching session has expired.";
    }
    return "Your session has reached its time limit.";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <main className="max-w-md w-full" role="main">
        <Card>
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Clock className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl">Session Expired</CardTitle>
            <CardDescription className="text-base mt-2">
              {getContextMessage()}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              For privacy and security, all chat sessions automatically expire after 24 hours. 
              This ensures your conversations remain temporary and protected.
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="font-medium text-foreground">What happens next?</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Your session data has been cleared</li>
                <li>You can start a fresh session anytime</li>
                <li>All previous conversations are deleted</li>
              </ul>
            </div>

            <p className="text-xs">
              Learn more about how we handle your data in our{" "}
              <Link 
                to="/data-retention" 
                className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
              >
                Data Retention Policy
              </Link>
            </p>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row gap-3 pt-6">
            <Button 
              onClick={handleStartNew} 
              className="w-full sm:flex-1"
              aria-label="Start a new session and begin matching"
            >
              Start New Session
            </Button>
            <Button 
              onClick={handleReturnHome} 
              variant="outline"
              className="w-full sm:flex-1"
              aria-label="Return to home page"
            >
              Back to Home
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
