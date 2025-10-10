import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PostChatDialogProps {
  open: boolean;
  onNewConversation: () => void;
  onReturnHome: () => void;
  onClose?: () => void; // Soft close option
  variant?: 'user-ended' | 'partner-left'; // Differentiate between scenarios
  partnerUsername?: string; // For personalized message
  onReflection?: () => void; // Optional reflection callback for partner-left
}

export const PostChatDialog = ({ 
  open, 
  onNewConversation, 
  onReturnHome,
  onClose,
  variant = 'user-ended',
  partnerUsername = 'Your partner',
  onReflection
}: PostChatDialogProps) => {
  // Determine content based on variant
  const title = variant === 'partner-left' 
    ? `${partnerUsername} has left the chat for now...`
    : 'Thank you for chatting!';
  
  const description = 'What would you like to do next?';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md animate-fade-in">
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription className="text-base pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <Button 
            onClick={onNewConversation} 
            size="lg"
            className="w-full"
          >
            Start a new conversation
          </Button>
          <Button 
            onClick={onReturnHome} 
            variant="outline" 
            size="lg"
            className="w-full"
          >
            Return home
          </Button>
          
          {/* Optional reflection link - shown for partner-left variant */}
          {onReflection && variant === 'partner-left' && (
            <button
              onClick={onReflection}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline mt-2"
            >
              Share your reflection
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
