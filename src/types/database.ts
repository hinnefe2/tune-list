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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cards: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          kind: Database["public"]["Enums"]["card_kind"]
          notes: string | null
          tune_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind: Database["public"]["Enums"]["card_kind"]
          notes?: string | null
          tune_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["card_kind"]
          notes?: string | null
          tune_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_tune_id_fkey"
            columns: ["tune_id"]
            isOneToOne: false
            referencedRelation: "tunes"
            referencedColumns: ["id"]
          },
        ]
      }
      library_shares: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          viewer_id?: string
        }
        Relationships: []
      }
      media_links: {
        Row: {
          created_at: string
          end_seconds: number | null
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          notes: string | null
          section: string | null
          start_seconds: number | null
          storage_path: string | null
          title: string | null
          tune_id: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          end_seconds?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          notes?: string | null
          section?: string | null
          start_seconds?: number | null
          storage_path?: string | null
          title?: string | null
          tune_id: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          end_seconds?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          notes?: string | null
          section?: string | null
          start_seconds?: number | null
          storage_path?: string | null
          title?: string | null
          tune_id?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_links_tune_id_fkey"
            columns: ["tune_id"]
            isOneToOne: false
            referencedRelation: "tunes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          notes: string | null
          recorded_at: string
          source_id: string | null
          storage_path: string
          tune_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          recorded_at?: string
          source_id?: string | null
          storage_path: string
          tune_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          recorded_at?: string
          source_id?: string | null
          storage_path?: string
          tune_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordings_tune_id_fkey"
            columns: ["tune_id"]
            isOneToOne: false
            referencedRelation: "tunes"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          card_id: string
          ease_factor: number
          id: string
          interval_days: number
          next_review_on: string
          rating: number
          reviewed_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          ease_factor?: number
          id?: string
          interval_days?: number
          next_review_on: string
          rating: number
          reviewed_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          ease_factor?: number
          id?: string
          interval_days?: number
          next_review_on?: string
          rating?: number
          reviewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards_with_state"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["source_kind"]
          name: string
          notes: string | null
          occurred_on: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["source_kind"]
          name: string
          notes?: string | null
          occurred_on?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["source_kind"]
          name?: string
          notes?: string | null
          occurred_on?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tune_sources: {
        Row: {
          created_at: string
          heard_on: string | null
          id: string
          notes: string | null
          source_id: string
          tune_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          heard_on?: string | null
          id?: string
          notes?: string | null
          source_id: string
          tune_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          heard_on?: string | null
          id?: string
          notes?: string | null
          source_id?: string
          tune_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tune_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tune_sources_tune_id_fkey"
            columns: ["tune_id"]
            isOneToOne: false
            referencedRelation: "tunes"
            referencedColumns: ["id"]
          },
        ]
      }
      tunes: {
        Row: {
          aka: string[]
          alt_keys: string[]
          created_at: string
          genre: string | null
          id: string
          key: string | null
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["tune_status"]
          tuning: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aka?: string[]
          alt_keys?: string[]
          created_at?: string
          genre?: string | null
          id?: string
          key?: string | null
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["tune_status"]
          tuning?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aka?: string[]
          alt_keys?: string[]
          created_at?: string
          genre?: string | null
          id?: string
          key?: string | null
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["tune_status"]
          tuning?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      cards_with_state: {
        Row: {
          created_at: string | null
          ease_factor: number | null
          enabled: boolean | null
          id: string | null
          interval_days: number | null
          kind: Database["public"]["Enums"]["card_kind"] | null
          last_rating: number | null
          last_review_id: string | null
          last_reviewed_at: string | null
          next_review_on: string | null
          notes: string | null
          tune_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_tune_id_fkey"
            columns: ["tune_id"]
            isOneToOne: false
            referencedRelation: "tunes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_view: { Args: { target_user_id: string }; Returns: boolean }
    }
    Enums: {
      card_kind:
        | "a_part"
        | "b_part"
        | "c_part"
        | "key"
        | "name_from_audio"
        | "source"
        | "other"
      media_kind:
        | "audio"
        | "video"
        | "spotify"
        | "sheet_music"
        | "looptube"
        | "tab"
        | "other"
      source_kind:
        | "festival"
        | "jam"
        | "person"
        | "lesson"
        | "recording"
        | "other"
      tune_status:
        | "wishlist"
        | "learning"
        | "can_fake"
        | "can_lead"
        | "forgotten"
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
    Enums: {
      card_kind: [
        "a_part",
        "b_part",
        "c_part",
        "key",
        "name_from_audio",
        "source",
        "other",
      ],
      media_kind: [
        "audio",
        "video",
        "spotify",
        "sheet_music",
        "looptube",
        "tab",
        "other",
      ],
      source_kind: [
        "festival",
        "jam",
        "person",
        "lesson",
        "recording",
        "other",
      ],
      tune_status: [
        "wishlist",
        "learning",
        "can_fake",
        "can_lead",
        "forgotten",
      ],
    },
  },
} as const
