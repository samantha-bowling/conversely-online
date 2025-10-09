import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReflectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (rating: number | null, feedback: string) => void;
  onSkip: () => void;
}

export const ReflectionDialog = ({ 
  open, 
  onOpenChange, 
  onSubmit,
  onSkip 
}: ReflectionDialogProps) => {
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(rating, feedback);
      // Dialog will close via parent's setShowReflectionDialog(false)
      // Add small delay for UX smoothness
      setTimeout(() => {
        setRating(null);
        setFeedback("");
        setHoveredStar(null);
      }, 300);
    } catch (error) {
      console.error('Error submitting reflection:', error);
      // Keep dialog open on error so user can retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onSkip();
    // Reset state
    setRating(null);
    setFeedback("");
    setHoveredStar(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="reflection-description" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was your conversation?</DialogTitle>
          <DialogDescription id="reflection-description">
            Your feedback helps us improve the experience for everyone
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Rate your experience (optional)</label>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(null)}
                  className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded"
                  aria-label={`Rate ${star} out of 5 stars`}
                >
                  <Star
                    className={cn(
                      "w-8 h-8 transition-colors",
                      (hoveredStar !== null ? star <= hoveredStar : star <= (rating || 0))
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Text */}
          <div className="space-y-2">
            <label htmlFor="reflection-feedback" className="text-sm font-medium">
              Share your thoughts (optional)
            </label>
            <Textarea
              id="reflection-feedback"
              placeholder="What did you think about this conversation?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={4}
              className="resize-none"
            />
            <div className="text-xs text-muted-foreground text-right">
              {feedback.length}/500
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            onClick={handleSkip}
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={(!rating && !feedback.trim()) || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
