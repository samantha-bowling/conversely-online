// Router location state types
export interface ChatLocationState {
  room_id: string;
}

// Edge Function response types
export interface CreateSessionResponse {
  id: string;
  username: string;
  avatar: string;
  expires_at: string;
  auth_session?: {
    access_token: string;
    refresh_token: string;
    user: { id: string };
  };
}

export interface MatchOppositeResponse {
  status: 'match_found' | 'no_match' | 'cooldown' | 'rate_limited';
  room_id?: string;
  wait_seconds?: number;
  retry_after?: number;
}

export interface GetRoomDataResponse {
  status: 'active' | 'ended';
  partner_id: string;
  room_id: string;
  partner_username: string;
  partner_avatar: string;
}

export interface SendMessageResponse {
  success: boolean;
  message_id: string;
}

export interface EndChatResponse {
  success: boolean;
  status: 'ended';
}

export interface BlockUserResponse {
  success: boolean;
  blocked: boolean;
}

// Activity level response
export interface ActivityLevel {
  level: 'active' | 'building' | 'quiet';
  message: string;
  icon: string;
}

// Realtime payload types
export interface MessagePayload {
  id: string;
  session_id: string;
  room_id: string;
  content: string;
  created_at: string;
  expires_at: string;
}

export interface ChatRoomPayload {
  id: string;
  session_a: string;
  session_b: string;
  status: string;
  created_at: string;
  ended_at: string | null;
  last_activity: string;
}
