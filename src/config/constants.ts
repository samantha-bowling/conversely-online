// Timing constants (in milliseconds)
export const TIMING = {
  MESSAGE_FADE_START: 40000, // 40 seconds until message starts fading
  MESSAGE_AUTO_DELETE: 60000, // 60 seconds until message is deleted
  ROOM_REDIRECT_DELAY: 2000, // 2 seconds delay before redirecting after room ends
  MATCHING_SEARCH_DELAY: 2000, // 2 seconds delay before searching for match
  MATCH_FOUND_REDIRECT: 1500, // 1.5 seconds delay before redirecting to chat
} as const;

// Validation constants
export const VALIDATION = {
  MAX_MESSAGE_LENGTH: 500,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NO_SESSION: "No active session",
  NO_CONVERSATION: "No active conversation found",
  ROOM_NOT_FOUND: "Room not found",
  SEND_MESSAGE_FAILED: "Failed to send message",
  END_CHAT_FAILED: "Failed to end chat",
  BLOCK_USER_FAILED: "Failed to block user",
  RATE_LIMITED: "Please slow down - you're sending messages too quickly",
  INAPPROPRIATE_CONTENT: "Message contains inappropriate content",
  TOO_MANY_BLOCKS: "Too many blocks - please wait before blocking again",
  MATCH_ERROR: "Error finding match",
  SURVEY_SAVE_ERROR: "Error saving survey answers",
  SESSION_CREATE_ERROR: "Error creating session",
  SESSION_RATE_LIMITED: "Too many session requests",
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  USER_BLOCKED: "User blocked and chat ended",
  CONVERSATION_ENDED: "Conversation ended",
} as const;

// Status messages
export const STATUS_MESSAGES = {
  CONNECTED: "Connected to conversation partner",
  DISCONNECTED: "Conversation ended",
  SEARCHING: "Searching for a conversation partner",
  MATCH_FOUND: "Match found! Connecting to conversation",
  NO_MATCH: "No match found at this time",
} as const;
