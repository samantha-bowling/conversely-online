import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ConversationButton } from "@/components/ConversationButton";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft } from "lucide-react";
import { handleError } from "@/lib/error-handler";
import { ERROR_MESSAGES } from "@/config/constants";
import { getRandomizedQuestions } from "@/config/survey";
import { isAcceptanceCurrent } from "@/utils/legalAcceptance";
import { toast } from "sonner";
import type { TablesInsert } from '@/integrations/supabase/types';

const Survey = () => {
  const navigate = useNavigate();
  const { session } = useSession();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [progressAnnouncement, setProgressAnnouncement] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);

  // Randomize 3-5 questions on mount
  const [questions] = useState(() => getRandomizedQuestions({ min: 3, max: 5 }));

  const handleAnswer = async (answer: string) => {
    const questionId = questions[currentQuestion].id;
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      const nextQuestion = currentQuestion + 1;
      setCurrentQuestion(nextQuestion);
      setProgressAnnouncement(`Question ${nextQuestion + 1} of ${questions.length}`);
    } else {
      // Check legal acceptance before completing survey
      if (!legalAccepted) {
        toast.error("Please accept the Terms of Service and Privacy Policy to continue");
        return;
      }

      if (!isAcceptanceCurrent()) {
        toast.error("Please review and accept our legal documents");
        navigate("/");
        return;
      }

      // Survey complete, save to database
      setSubmitting(true);
      try {
        type SurveyAnswerInsert = TablesInsert<'survey_answers'>;

        const answersArray: SurveyAnswerInsert[] = Object.entries(newAnswers).map(([question_id, answer]) => ({
          session_id: session?.id!,
          question_id,
          answer,
        }));

        const { error } = await supabase
          .from('survey_answers')
          .insert(answersArray);

        if (error) throw error;

        navigate("/matching");
      } catch (error) {
        handleError(error, { description: ERROR_MESSAGES.SURVEY_SAVE_ERROR });
        setSubmitting(false);
      }
    }
  };

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen flex flex-col p-4 animate-fade-in-gentle">
      {/* Screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {progressAnnouncement}
      </div>
      
      {/* Header */}
      <header className="flex items-center justify-between mb-8 pt-4" role="banner">
        <button
          onClick={() => currentQuestion > 0 ? setCurrentQuestion(currentQuestion - 1) : navigate("/")}
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
          aria-label={currentQuestion > 0 ? "Go to previous question" : "Go back to home"}
        >
          <ChevronLeft className="w-6 h-6" aria-hidden="true" />
        </button>
        <div className="text-sm text-muted-foreground font-medium" aria-live="polite">
          {currentQuestion + 1} of {questions.length}
        </div>
      </header>

      {/* Progress Bar */}
      <div 
        className="w-full h-1 bg-secondary rounded-full mb-12"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Survey progress: ${Math.round(progress)}% complete`}
      >
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full" role="main">
        <fieldset className="w-full">
          <legend className="text-2xl font-bold text-center mb-12 leading-relaxed">
            {question.question}
          </legend>

          <div className="w-full space-y-4">
            {question.options.map((option) => (
            <ConversationButton
              key={option}
              variant="outline"
              onClick={() => handleAnswer(option)}
              disabled={submitting}
              aria-label={`Select ${option}`}
            >
              {option}
            </ConversationButton>
            ))}
          </div>
        </fieldset>
      </main>

      {/* Legal Acceptance */}
      {currentQuestion === questions.length - 1 && (
        <div className="pt-8 max-w-lg mx-auto">
          <label className="flex items-start gap-3 p-4 border border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
            <input
              type="checkbox"
              checked={legalAccepted}
              onChange={(e) => setLegalAccepted(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-muted-foreground">
              I confirm I am 16 years or older and agree to the{' '}
              <Link to="/terms" target="_blank" className="text-primary hover:underline">
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </span>
          </label>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground pt-8">
        Your answers help us match you with someone who sees things differently
      </p>

      {/* Footer */}
      <footer className="pt-8">
        <div className="text-center text-xs text-muted-foreground space-x-2">
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <span>•</span>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <span>•</span>
          <a href="mailto:hello@conversely.online" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </footer>
    </div>
  );
};

export default Survey;
