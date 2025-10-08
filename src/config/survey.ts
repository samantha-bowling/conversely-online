export interface SurveyQuestion {
  id: string;
  question: string;
  options: [string, string];
}

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: "energy-style",
    question: "I'm more energized by:",
    options: ["Small, deep chats", "Big, lively groups"],
  },
  {
    id: "planning",
    question: "I prefer plans that are:",
    options: ["Spontaneous", "Scheduled"],
  },
  {
    id: "learning",
    question: "When learning, I start with:",
    options: ["Doing", "Reading/Watching"],
  },
  {
    id: "recharge",
    question: "I recharge by:",
    options: ["Alone time", "Being around people"],
  },
  {
    id: "texting",
    question: "My texting style is:",
    options: ["Short + direct", "Long + detailed"],
  },
  {
    id: "conversation",
    question: "I like conversations that are:",
    options: ["Focused on ideas", "Grounded in stories"],
  },
  {
    id: "conflict",
    question: "I handle conflict by:",
    options: ["Addressing it fast", "Giving it space"],
  },
  {
    id: "decisions",
    question: "On decisions, I lean:",
    options: ["Gut feel", "Pros/cons list"],
  },
  {
    id: "punctuality",
    question: "I show up to things:",
    options: ["Early", "Right on time/late"],
  },
  {
    id: "weekend",
    question: "My ideal weekend:",
    options: ["Out and about", "Home and cozy"],
  },
  {
    id: "feedback",
    question: "I prefer feedback that is:",
    options: ["Blunt and clear", "Gentle and encouraging"],
  },
  {
    id: "goals",
    question: "For goals, I'm:",
    options: ["Big-picture first", "Step-by-step first"],
  },
  {
    id: "space",
    question: "I keep my space:",
    options: ["Minimal", "Lived-in"],
  },
  {
    id: "topic",
    question: "I'd rather talk about:",
    options: ["The future", "The present"],
  },
  {
    id: "chat-role",
    question: "In a chat, I'm usually:",
    options: ["The asker", "The sharer"],
  },
  {
    id: "time-off",
    question: "Time off:",
    options: ["Try something new", "Do a favorite thing"],
  },
  {
    id: "stories",
    question: "I prefer stories that are:",
    options: ["Fictional/imagined", "Real/lived"],
  },
  {
    id: "thinking",
    question: "I think best while:",
    options: ["Moving", "Sitting still"],
  },
  {
    id: "humor",
    question: "My humor:",
    options: ["Dry/understated", "Big/expressive"],
  },
  {
    id: "time-preference",
    question: "Morning vs night:",
    options: ["Morning", "Night"],
  },
  {
    id: "discussion",
    question: "I'd rather discuss:",
    options: ["Why", "How"],
  },
  {
    id: "surprises",
    question: "For surprises, I'm:",
    options: ["Love them", "Please no"],
  },
  {
    id: "change",
    question: "In change, I'm:",
    options: ["Early adopter", "Wait-and-see"],
  },
  {
    id: "outlook",
    question: "I'm more:",
    options: ["Optimistic", "Skeptical"],
  },
] as const;

export const getRandomizedQuestions = (): SurveyQuestion[] => {
  const shuffled = [...SURVEY_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5);
};
