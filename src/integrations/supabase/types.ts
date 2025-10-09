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
            foreignKeyName: "blocked_pairs_session_a_fkey"
            columns: ["session_a"]
            isOneToOne: false
            referencedRelation: "guest_sessions_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_pairs_session_b_fkey"
            columns: ["session_b"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_pairs_session_b_fkey"
            columns: ["session_b"]
            isOneToOne: false
            referencedRelation: "guest_sessions_public"
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
            foreignKeyName: "chat_rooms_session_a_fkey"
            columns: ["session_a"]
            isOneToOne: false
            referencedRelation: "guest_sessions_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_session_b_fkey"
            columns: ["session_b"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_session_b_fkey"
            columns: ["session_b"]
            isOneToOne: false
            referencedRelation: "guest_sessions_public"
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
          last_quick_exit: string | null
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
          last_quick_exit?: string | null
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
          last_quick_exit?: string | null
          next_match_at?: string | null
          quick_exits?: number
          reputation_score?: number
          times_blocked?: number
          user_id?: string
          username?: string
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
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "guest_sessions_public"
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
          {
            foreignKeyName: "survey_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "guest_sessions_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      guest_sessions_public: {
        Row: {
          avatar: string | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          last_quick_exit: string | null
          next_match_at: string | null
          quick_exits: number | null
          reputation_score: number | null
          times_blocked: number | null
          username: string | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          last_quick_exit?: string | null
          next_match_at?: string | null
          quick_exits?: number | null
          reputation_score?: number | null
          times_blocked?: number | null
          username?: string | null
        }
        Update: {
          avatar?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          last_quick_exit?: string | null
          next_match_at?: string | null
          quick_exits?: number | null
          reputation_score?: number | null
          times_blocked?: number | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_see_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_expired_messages: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      close_inactive_rooms: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
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
