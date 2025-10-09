import { toast } from "sonner";

interface ErrorHandlerOptions {
  title?: string;
  description?: string;
  showToast?: boolean;
  logToConsole?: boolean;
}

/**
 * Centralized error handler for consistent error management
 * @param error - The error to handle
 * @param options - Configuration options for error handling
 */
export const handleError = (
  error: unknown,
  options: ErrorHandlerOptions = {}
): void => {
  const {
    title = "Error",
    description,
    showToast = true,
    logToConsole = true,
  } = options;

  // Extract error message
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Log to console in development
  if (logToConsole && import.meta.env.DEV) {
    console.error(`[${title}]:`, errorMessage, error);
  }

  // Show toast notification
  if (showToast) {
    toast.error(description || errorMessage);
  }
};

/**
 * Handle specific API errors with custom messages
 */
export const handleApiError = (error: unknown, fallbackMessage: string): void => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message);
    
    // Handle known error types
    if (message.includes('409') || message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('already submitted')) {
      handleError(error, {
        description: 'Survey already completed - redirecting...',
      });
    } else if (message.includes('Rate limit exceeded')) {
      handleError(error, {
        description: 'Please slow down - you\'re sending messages too quickly',
      });
    } else if (message.includes('inappropriate content')) {
      handleError(error, {
        description: 'Message contains inappropriate content',
      });
    } else if (message.includes('Too many blocks')) {
      handleError(error, {
        description: 'Too many blocks - please wait before blocking again',
      });
    } else {
      handleError(error, { description: fallbackMessage });
    }
  } else {
    handleError(error, { description: fallbackMessage });
  }
};
