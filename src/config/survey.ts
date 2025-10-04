export interface SurveyQuestion {
  id: string;
  question: string;
  options: [string, string];
}

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
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
] as const;

export const getRandomizedQuestions = (count: { min: number; max: number }): SurveyQuestion[] => {
  const shuffled = [...SURVEY_QUESTIONS].sort(() => Math.random() - 0.5);
  const questionCount = Math.floor(Math.random() * (count.max - count.min + 1)) + count.min;
  return shuffled.slice(0, questionCount);
};
