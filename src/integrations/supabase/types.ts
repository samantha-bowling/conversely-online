export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      blocked_pairs: {
        Row: {
          created_at: string
          id: string
          session_a: string
          session_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_a: string
          session_b: string
        }
        Update: {
          created_at?: string
          id?: string
          session_a?: string
          session_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_pairs_session_a_fkey"
            columns: ["session_a"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_pairs_session_b_fkey"
            columns: ["session_b"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          last_activity: string
          session_a: string
          session_b: string
          status: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          last_activity?: string
          session_a: string
          session_b: string
          status?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          last_activity?: string
          session_a?: string
          session_b?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_session_a_fkey"
            columns: ["session_a"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_session_b_fkey"
            columns: ["session_b"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sessions: {
        Row: {
          avatar: string
          created_at: string
          expires_at: string
          id: string
          is_searching: boolean | null
          is_test: boolean | null
          last_heartbeat_at: string | null
          last_matched_at: string | null
          last_matched_session_id: string | null
          last_quick_exit: string | null
          last_validated_at: string | null
          next_match_at: string | null
          quick_exits: number
          reputation_score: number
          times_blocked: number
          user_id: string
          username: string
        }
        Insert: {
          avatar: string
          created_at?: string
          expires_at?: string
          id?: string
          is_searching?: boolean | null
          is_test?: boolean | null
          last_heartbeat_at?: string | null
          last_matched_at?: string | null
          last_matched_session_id?: string | null
          last_quick_exit?: string | null
          last_validated_at?: string | null
          next_match_at?: string | null
          quick_exits?: number
          reputation_score?: number
          times_blocked?: number
          user_id?: string
          username: string
        }
        Update: {
          avatar?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_searching?: boolean | null
          is_test?: boolean | null
          last_heartbeat_at?: string | null
          last_matched_at?: string | null
          last_matched_session_id?: string | null
          last_quick_exit?: string | null
          last_validated_at?: string | null
          next_match_at?: string | null
          quick_exits?: number
          reputation_score?: number
          times_blocked?: number
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_sessions_last_matched_session_id_fkey"
            columns: ["last_matched_session_id"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          closed_count: number
          created_at: string
          id: string
          job_name: string
          safety_clamp_triggered: boolean
          would_close_count: number
        }
        Insert: {
          closed_count?: number
          created_at?: string
          id?: string
          job_name: string
          safety_clamp_triggered?: boolean
          would_close_count?: number
        }
        Update: {
          closed_count?: number
          created_at?: string
          id?: string
          job_name?: string
          safety_clamp_triggered?: boolean
          would_close_count?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          expires_at: string
          id: string
          room_id: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          expires_at?: string
          id?: string
          room_id: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          expires_at?: string
          id?: string
          room_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reflections: {
        Row: {
          created_at: string | null
          feedback: string | null
          id: string
          rating: number | null
          room_id: string
          session_id: string
        }
        Insert: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          rating?: number | null
          room_id: string
          session_id: string
        }
        Update: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          rating?: number | null
          room_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reflections_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reflections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_answers: {
        Row: {
          answer: string
          created_at: string
          id: string
          question_id: string
          session_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question_id: string
          session_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      atomic_create_match_room: {
        Args: { _session_a: string; _session_b: string }
        Returns: {
          room_id: string
          status: string
        }[]
      }
      can_see_room: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      can_see_room_messages: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      can_see_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      check_partner_heartbeat: {
        Args: { _my_session_id: string; _room_id: string }
        Returns: {
          last_heartbeat: string
          partner_alive: boolean
          partner_session_id: string
        }[]
      }
      cleanup_expired_messages: { Args: never; Returns: undefined }
      cleanup_expired_sessions: { Args: never; Returns: undefined }
      cleanup_old_maintenance_logs: { Args: never; Returns: undefined }
      close_inactive_rooms: { Args: never; Returns: undefined }
      get_health_snapshot: {
        Args: never
        Returns: {
          active_chats: number
          active_sessions: number
          last_cron_run: string
          recent_messages: number
          searching_users: number
          users_online_now: number
        }[]
      }
      get_maintenance_logs: {
        Args: { _limit?: number }
        Returns: {
          closed_count: number
          created_at: string
          id: string
          job_name: string
          safety_clamp_triggered: boolean
          would_close_count: number
        }[]
      }
      revoke_expired_guest_auth: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
