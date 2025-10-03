import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ConversationButton } from "@/components/ConversationButton";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

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

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('submit-reflection', {
        body: {
          session_id: session.id,
          room_id: roomId,
          rating: rating || null,
          feedback: feedback.trim() || null,
        },
      });

      if (error) {
        console.error('Error saving reflection:', error);
        // Don't block navigation even if reflection fails
      }

      if (data?.success || !rating) {
        // Navigate home whether reflection succeeded or was skipped
        navigate("/");
      } else {
        // If there was an issue but we got a response, still navigate
        navigate("/");
      }
    } catch (error) {
      console.error('Error saving reflection:', error);
      // Always navigate home, even on error
      navigate("/");
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
            />
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
