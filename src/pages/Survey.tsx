import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ConversationButton } from "@/components/ConversationButton";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft } from "lucide-react";
import { handleError } from "@/lib/error-handler";
import { ERROR_MESSAGES } from "@/config/constants";
import { SURVEY_QUESTIONS, type SurveyQuestion } from "@/config/survey";
import { isAcceptanceCurrent } from "@/utils/legalAcceptance";
import { toast } from "sonner";
import type { TablesInsert } from '@/integrations/supabase/types';
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useLegalSheet } from "@/hooks/useLegalSheet";

const Survey = () => {
  const navigate = useNavigate();
  const { session } = useSession();
  const { openTerms, openPrivacy, LegalSheet } = useLegalSheet();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [progressAnnouncement, setProgressAnnouncement] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch synchronized question pack on mount
  useEffect(() => {
    const fetchQuestionPack = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-question-pack');
        
        if (error) throw error;
        
        // Map question IDs to full question objects
        const packQuestions = data.question_ids.map((id: string) => 
          SURVEY_QUESTIONS.find(q => q.id === id)
        ).filter(Boolean) as SurveyQuestion[];
        
        setQuestions(packQuestions);
        console.log('Loaded question pack:', data.pack_id, packQuestions.map(q => q.id));
      } catch (error) {
        console.error('Error fetching question pack:', error);
        handleError(error, { description: "Failed to load questions. Please refresh." });
      } finally {
        setLoading(false);
      }
    };

    fetchQuestionPack();
  }, []);

  const handleAnswer = (answer: string) => {
    const questionId = questions[currentQuestion].id;
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      const nextQuestion = currentQuestion + 1;
      setCurrentQuestion(nextQuestion);
      setProgressAnnouncement(`Question ${nextQuestion + 1} of ${questions.length}`);
    } else {
      // All questions answered, show confirmation
      setShowConfirmation(true);
      setProgressAnnouncement("Review your answers");
    }
  };

  const handleSubmit = async () => {
    // Final legal check before submission
    if (!isAcceptanceCurrent()) {
      toast.error("Please review and accept our legal documents");
      navigate("/");
      return;
    }

    setSubmitting(true);
    try {
      type SurveyAnswerInsert = TablesInsert<'survey_answers'>;

      const answersArray: SurveyAnswerInsert[] = Object.entries(answers).map(([question_id, answer]) => ({
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
  };

  const handleGoBack = () => {
    setShowConfirmation(false);
  };

  const question = questions[currentQuestion];
  const progress = questions.length > 0 ? ((currentQuestion + 1) / questions.length) * 100 : 0;

  // Show loading state while fetching questions
  if (loading || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading questions...</p>
        </div>
      </div>
    );
  }

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

      {/* Question or Confirmation */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full" role="main">
        {!showConfirmation ? (
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
        ) : (
          <div className="w-full space-y-8">
            <h2 className="text-2xl font-bold text-center">Review Your Answers</h2>
            
            <div className="space-y-4">
              {questions.map((q, index) => (
                <div 
                  key={q.id} 
                  className="p-4 rounded-lg border border-border bg-card"
                >
                  <p className="text-sm text-muted-foreground mb-2">
                    Question {index + 1}
                  </p>
                  <p className="font-medium mb-2">{q.question}</p>
                  <p className="text-primary font-semibold">
                    {answers[q.id]}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <ConversationButton
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Starting..." : "Start Matching"}
              </ConversationButton>
              <ConversationButton
                variant="outline"
                onClick={handleGoBack}
                disabled={submitting}
              >
                Go Back
              </ConversationButton>
            </div>
          </div>
        )}
      </main>

      {!showConfirmation && (
        <p className="text-center text-sm text-muted-foreground pt-8">
          Your answers help us match you with someone who sees things differently
        </p>
      )}

      {/* Footer */}
      <footer className="pt-8">
        <Footer variant="default" />
      </footer>

      <LegalSheet />
    </div>
  );
};

export default Survey;
