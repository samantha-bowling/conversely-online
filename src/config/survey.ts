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
  {
    id: "group-role",
    question: "In a group effort, I naturally gravitate to:",
    options: ["Leading the charge", "Supporting the lead"],
  },
  {
    id: "work-focus",
    question: "My work focus is usually:",
    options: ["One thing at a time", "Multiple things in parallel"],
  },
  {
    id: "creativity-spark",
    question: "Creativity sparks most when I have:",
    options: ["Clear constraints", "A blank canvas"],
  },
  {
    id: "nature-pull",
    question: "Nature pull:",
    options: ["Mountains", "Ocean"],
  },
  {
    id: "souvenirs",
    question: "Souvenirs I value most:",
    options: ["Photos/memories", "Physical items"],
  },
  {
    id: "learning-check",
    question: "To check if I've learned something, I prefer:",
    options: ["Teaching it to someone", "Taking a quick quiz"],
  },
  {
    id: "notes-style",
    question: "Notes live best in:",
    options: ["A paper notebook", "A digital app"],
  },
  {
    id: "music-notice",
    question: "When I listen to music, I notice first:",
    options: ["Lyrics", "Beat & melody"],
  },
  {
    id: "movies",
    question: "Watching movies is better:",
    options: ["In a theater", "At home"],
  },
  {
    id: "quick-communication",
    question: "Quick communication:",
    options: ["Voice call", "Text message"],
  },
  {
    id: "social-platforms",
    question: "On social platforms, I mostly:",
    options: ["Post/share", "Browse/lurk"],
  },
  {
    id: "tracking-progress",
    question: "Tracking progress works best with:",
    options: ["Daily streaks/check-ins", "Big milestones"],
  },
  {
    id: "decision-timing",
    question: "Decision timing:",
    options: ["Decide now", "Sleep on it"],
  },
  {
    id: "taste-preference",
    question: "Taste preference:",
    options: ["Savory", "Sweet"],
  },
  {
    id: "pets",
    question: "Pets I click with more:",
    options: ["Dogs", "Cats"],
  },
  {
    id: "games",
    question: "Games I tend to enjoy more:",
    options: ["Strategy", "Action"],
  },
  {
    id: "exercise-pace",
    question: "Exercise pace I prefer:",
    options: ["Steady cardio", "Interval/HIIT bursts"],
  },
  {
    id: "reading-format",
    question: "Reading format I reach for:",
    options: ["Audiobooks", "Print/e-books"],
  },
  {
    id: "digital-organizing",
    question: "Digital organizing style:",
    options: ["Carefully nested folders", "Search-everything approach"],
  },
  {
    id: "workspace-sound",
    question: "Workspace sound:",
    options: ["Silence", "Background noise"],
  },
  {
    id: "weather-thrive",
    question: "Weather I thrive in:",
    options: ["Sunshine", "Rain"],
  },
  {
    id: "everyday-setting",
    question: "Everyday setting I prefer:",
    options: ["City buzz", "Quiet nature"],
  },
  {
    id: "beverage",
    question: "Go-to beverage:",
    options: ["Coffee", "Tea"],
  },
  {
    id: "cooking-approach",
    question: "Cooking approach:",
    options: ["Follow the recipe", "Improvise as I go"],
  },
  {
    id: "shopping-mindset",
    question: "Shopping mindset:",
    options: ["Buy once, quality", "Hunt for the best deal"],
  },
  {
    id: "photography-style",
    question: "Photography style I like:",
    options: ["Candid", "Posed"],
  },
  {
    id: "wardrobe-leaning",
    question: "Wardrobe leaning:",
    options: ["Functional basics", "Statement pieces"],
  },
  {
    id: "cleaning-approach",
    question: "Cleaning approach:",
    options: ["Tidy a little daily", "Occasional deep clean"],
  },
  {
    id: "alarm-routine",
    question: "Alarm routine:",
    options: ["Snooze a few times", "Up on the first ring"],
  },
  {
    id: "book-habit",
    question: "Book habit:",
    options: ["Finish every book", "Drop it if it's not clicking"],
  },
  {
    id: "getting-around",
    question: "Getting around:",
    options: ["Drive myself", "Public transit"],
  },
  {
    id: "phone-settings",
    question: "Phone settings:",
    options: ["Most notifications on", "Most notifications off"],
  },
  {
    id: "dining-picks",
    question: "Dining picks:",
    options: ["Hole-in-the-wall spots", "Well-known favorites"],
  },
  {
    id: "work-break-style",
    question: "Work break style:",
    options: ["Short, frequent breaks", "Long, focused sessions"],
  },
  {
    id: "home-projects",
    question: "Home projects:",
    options: ["DIY it", "Hire a pro"],
  },
  {
    id: "gift-giving-style",
    question: "Gift-giving style:",
    options: ["Practical/useful", "Sentimental/meaningful"],
  },
] as const;

export const getRandomizedQuestions = (): SurveyQuestion[] => {
  const shuffled = [...SURVEY_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5);
};
