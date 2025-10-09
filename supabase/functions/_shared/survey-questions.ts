// Single source of truth for survey question IDs (validation only)
// IMPORTANT: src/config/survey.ts is the canonical source for question metadata
// This file mirrors IDs only for backend validation

export const ALL_QUESTION_IDS = [
  "energy-style", "planning", "learning", "recharge", "texting",
  "conversation", "conflict", "decisions", "punctuality", "weekend",
  "feedback", "goals", "space", "topic", "chat-role",
  "time-off", "stories", "thinking", "humor", "time-preference",
  "discussion", "surprises", "change", "outlook", "group-role",
  "work-focus", "creativity-spark", "nature-pull", "souvenirs", "learning-check",
  "notes-style", "music-notice", "movies", "quick-communication", "social-platforms",
  "tracking-progress", "decision-timing", "taste-preference", "pets", "games",
  "exercise-pace", "reading-format", "digital-organizing", "workspace-sound", "weather-thrive",
  "everyday-setting", "beverage", "cooking-approach", "shopping-mindset", "photography-style",
  "wardrobe-leaning", "cleaning-approach", "alarm-routine", "book-habit", "getting-around",
  "phone-settings", "dining-picks", "work-break-style", "home-projects", "gift-giving-style"
] as const;

export type QuestionId = typeof ALL_QUESTION_IDS[number];

// Type-safe validation helper
export function isValidQuestionId(id: string): id is QuestionId {
  return ALL_QUESTION_IDS.includes(id as QuestionId);
}
