import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ConversationButton } from "@/components/ConversationButton";
import { handleError } from "@/lib/error-handler";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    handleError(
      new Error(`404 Error: User attempted to access non-existent route: ${location.pathname}`),
      {
        title: "404 Error",
        showToast: false,
        logToConsole: true,
      }
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-md w-full px-4 space-y-6">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="text-xl text-muted-foreground">Oops! Page not found</p>
        <p className="text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="pt-4">
          <ConversationButton
            variant="primary"
            onClick={() => navigate("/")}
            aria-label="Return to home page"
          >
            Return to Home
          </ConversationButton>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
