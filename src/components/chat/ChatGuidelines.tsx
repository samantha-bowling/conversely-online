import { AlertCircle } from "lucide-react";
import { ConversationButton } from "@/components/ConversationButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ChatGuidelinesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChatGuidelines = ({ open, onOpenChange }: ChatGuidelinesProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="guidelines-description">
        <DialogHeader>
          <DialogTitle>Conversation Guidelines</DialogTitle>
          <DialogDescription id="guidelines-description" className="space-y-3 pt-2">
            <p className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
              <span>Don't share personal information</span>
            </p>
            <p className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
              <span>Keep it respectful and curious</span>
            </p>
            <p className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
              <span>Messages fade after a few moments</span>
            </p>
          </DialogDescription>
          <ConversationButton
            variant="primary"
            onClick={() => onOpenChange(false)}
            className="mt-4"
          >
            Start Conversation
          </ConversationButton>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
