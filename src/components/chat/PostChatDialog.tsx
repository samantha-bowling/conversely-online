import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PostChatDialogProps {
  open: boolean;
  onNewConversation: () => void;
  onReturnHome: () => void;
  onClose?: () => void; // Soft close option
}

export const PostChatDialog = ({ 
  open, 
  onNewConversation, 
  onReturnHome,
  onClose 
}: PostChatDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md animate-fade-in">
        <DialogHeader>
          <DialogTitle className="text-2xl">Thank you for chatting!</DialogTitle>
          <DialogDescription className="text-base pt-2">
            What would you like to do next?
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
