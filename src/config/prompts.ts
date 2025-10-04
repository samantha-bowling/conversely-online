export const ICEBREAKER_PROMPTS = [
  "What's one thing that surprised you in the past year?",
  "What matters most to you in your daily life?",
  "What's a belief you've changed your mind about?",
] as const;

export const getRandomPrompt = (): string => {
  return ICEBREAKER_PROMPTS[Math.floor(Math.random() * ICEBREAKER_PROMPTS.length)];
};
