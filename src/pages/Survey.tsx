import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ConversationButton } from "@/components/ConversationButton";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft } from "lucide-react";
import type { TablesInsert } from '@/integrations/supabase/types';

// Survey questions with binary choices
const SURVEY_QUESTIONS = [
  {
    id: "progress",
    question: "Is life today mostly better or worse than it used to be?",
    options: ["Better", "Worse"],
  },
  {
    id: "values",
    question: "What's more important: freedom or safety?",
    options: ["Freedom", "Safety"],
  },
  {
    id: "community",
    question: "Where do you feel more at home: small towns or big cities?",
    options: ["Small towns", "Big cities"],
  },
  {
    id: "politics",
    question: "Do you see yourself as more liberal or more conservative?",
    options: ["Liberal", "Conservative"],
  },
  {
    id: "success",
    question: "Do people do better when they compete or when they work together?",
    options: ["Compete", "Work together"],
  },
];

const Survey = () => {
  const navigate = useNavigate();
  const { session } = useSession();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [progressAnnouncement, setProgressAnnouncement] = useState("");

  // Randomize 3-5 questions on mount
  const [questions] = useState(() => {
    const shuffled = [...SURVEY_QUESTIONS].sort(() => Math.random() - 0.5);
    const count = Math.floor(Math.random() * 3) + 3; // 3-5 questions
    return shuffled.slice(0, count);
  });

  const handleAnswer = async (answer: string) => {
    const questionId = questions[currentQuestion].id;
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      const nextQuestion = currentQuestion + 1;
      setCurrentQuestion(nextQuestion);
      setProgressAnnouncement(`Question ${nextQuestion + 1} of ${questions.length}`);
    } else {
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
        console.error('Error saving survey answers:', error instanceof Error ? error.message : 'Unknown error');
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

      <p className="text-center text-sm text-muted-foreground pt-8">
        Your answers help us match you with someone who sees things differently
      </p>
    </div>
  );
};

export default Survey;
