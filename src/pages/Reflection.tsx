import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ConversationButton } from "@/components/ConversationButton";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { validateFeedback } from "@/lib/validation";

const Reflection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useSession();
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const roomId = location.state?.room_id;

  const handleSubmit = async () => {
    if (!session || !roomId) {
      navigate("/");
      return;
    }

    // Validate feedback if provided
    const feedbackText = feedback.trim();
    if (feedbackText) {
      const validation = validateFeedback(feedbackText);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('submit-reflection', {
        body: {
          session_id: session.id,
          room_id: roomId,
          rating: rating || null,
          feedback: feedbackText || null,
        },
      });

      if (error) {
        console.error('Error saving reflection:', error);
        toast.error('Failed to save reflection');
        setSubmitting(false);
        return;
      }

      if (data?.success || !rating) {
        toast.success('Thank you for your feedback');
        navigate("/");
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error('Error saving reflection:', error);
      toast.error('Failed to save reflection');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-fade-in-gentle">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Conversation ended</h2>
          <p className="text-muted-foreground">
            Thanks for taking a moment to connect
          </p>
        </div>

        <div className="space-y-6 pt-4">
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Was this conversation helpful?
            </label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
                      rating && star <= rating
                        ? "fill-primary text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="feedback" className="text-sm font-medium">
              Any thoughts? (optional)
            </label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Share your experience..."
              rows={4}
              className="resize-none"
              maxLength={1000}
            />
            <div className="text-xs text-muted-foreground text-right">
              {feedback.length}/1000 {feedback.length > 0 && feedback.length < 10 && "(min 10 characters)"}
            </div>
          </div>

          <ConversationButton
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : rating ? "Submit & Return Home" : "Skip"}
          </ConversationButton>
        </div>

        <p className="text-center text-xs text-muted-foreground pt-4">
          Your feedback is anonymous and helps us improve
        </p>
      </div>
    </div>
  );
};

export default Reflection;
