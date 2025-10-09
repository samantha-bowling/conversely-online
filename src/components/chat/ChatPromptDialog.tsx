import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shuffle } from "lucide-react";

interface ChatPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  shufflesRemaining: number;
  onShuffle: () => void;
  onInsert: () => void;
}

export const ChatPromptDialog = ({ 
  open, 
  onOpenChange, 
  prompt, 
  shufflesRemaining,
  onShuffle,
  onInsert 
}: ChatPromptDialogProps) => {
  const [isShuffling, setIsShuffling] = useState(false);

  const handleShuffle = useCallback(() => {
    if (shufflesRemaining <= 0 || isShuffling) return;
    
    setIsShuffling(true);
    onShuffle();
    
    // 300ms debounce
    setTimeout(() => {
      setIsShuffling(false);
    }, 300);
  }, [shufflesRemaining, isShuffling, onShuffle]);

  const handleInsert = () => {
    onInsert();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="prompt-description">
        <DialogHeader>
          <DialogTitle>Conversation Starter</DialogTitle>
          <DialogDescription id="prompt-description" className="pt-4 text-base">
            {prompt}
          </DialogDescription>
          <div className="flex gap-2 mt-6">
            <Button
              variant="outline"
              onClick={handleShuffle}
              disabled={shufflesRemaining <= 0 || isShuffling}
              className="gap-2"
            >
              <Shuffle className="w-4 h-4" />
              Shuffle {shufflesRemaining > 0 && `(${shufflesRemaining} left)`}
            </Button>
            <Button
              onClick={handleInsert}
              className="flex-1"
            >
              Use This Prompt
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="mt-2"
          >
            Close
          </Button>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
