import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ChatPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
}

export const ChatPromptDialog = ({ open, onOpenChange, prompt }: ChatPromptDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="prompt-description">
        <DialogHeader>
          <DialogTitle>Conversation Starter</DialogTitle>
          <DialogDescription id="prompt-description" className="pt-4 text-base">
            {prompt}
          </DialogDescription>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="mt-4"
          >
            Close
          </Button>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
