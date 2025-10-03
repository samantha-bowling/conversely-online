import { useState } from "react";
import { ConversationButton } from "@/components/ConversationButton";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

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
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Randomize 3-5 questions on mount
  const [questions] = useState(() => {
    const shuffled = [...SURVEY_QUESTIONS].sort(() => Math.random() - 0.5);
    const count = Math.floor(Math.random() * 3) + 3; // 3-5 questions
    return shuffled.slice(0, count);
  });

  const handleAnswer = (answer: string) => {
    const questionId = questions[currentQuestion].id;
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Survey complete - navigate to matching
      navigate("/matching", { state: { answers: newAnswers } });
    }
  };

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen flex flex-col p-4 animate-fade-in-gentle">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-4">
        <button
          onClick={() => currentQuestion > 0 ? setCurrentQuestion(currentQuestion - 1) : navigate("/")}
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="text-sm text-muted-foreground font-medium">
          {currentQuestion + 1} of {questions.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-secondary rounded-full mb-12">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-12 leading-relaxed">
          {question.question}
        </h2>

        <div className="w-full space-y-4">
          {question.options.map((option) => (
            <ConversationButton
              key={option}
              variant="outline"
              onClick={() => handleAnswer(option)}
            >
              {option}
            </ConversationButton>
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground pt-8">
        Your answers help us match you with someone who sees things differently
      </p>
    </div>
  );
};

export default Survey;
