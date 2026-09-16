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
      article_regulations: {
        Row: {
          article_source_id: string
          created_at: string
          id: string
          kind: string | null
          number: string | null
          reg_date: string | null
          subject: string | null
        }
        Insert: {
          article_source_id: string
          created_at?: string
          id?: string
          kind?: string | null
          number?: string | null
          reg_date?: string | null
          subject?: string | null
        }
        Update: {
          article_source_id?: string
          created_at?: string
          id?: string
          kind?: string | null
          number?: string | null
          reg_date?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      articles: {
        Row: {
          book_source_id: string
          chapter: string | null
          content: string | null
          created_at: string
          id: string
          label: string | null
          order_index: number
          scraped_at: string | null
          source_id: string
          title: string
          url: string
        }
        Insert: {
          book_source_id: string
          chapter?: string | null
          content?: string | null
          created_at?: string
          id?: string
          label?: string | null
          order_index?: number
          scraped_at?: string | null
          source_id: string
          title: string
          url: string
        }
        Update: {
          book_source_id?: string
          chapter?: string | null
          content?: string | null
          created_at?: string
          id?: string
          label?: string | null
          order_index?: number
          scraped_at?: string | null
          source_id?: string
          title?: string
          url?: string
        }
        Relationships: []
      }
      books: {
        Row: {
          articles_count: number
          category: string | null
          created_at: string
          id: string
          scraped_at: string | null
          source_id: string
          title: string
          url: string
        }
        Insert: {
          articles_count?: number
          category?: string | null
          created_at?: string
          id?: string
          scraped_at?: string | null
          source_id: string
          title: string
          url: string
        }
        Update: {
          articles_count?: number
          category?: string | null
          created_at?: string
          id?: string
          scraped_at?: string | null
          source_id?: string
          title?: string
          url?: string
        }
        Relationships: []
      }
      circulars: {
        Row: {
          content: string | null
          created_at: string
          id: string
          interpretation: string | null
          issuer: string | null
          kind: string | null
          number: string | null
          query_term: string | null
          reg_date: string | null
          related_articles: string | null
          scraped_at: string | null
          source_id: string
          source_name: string | null
          status: string | null
          subject: string | null
          updated_at: string
          url: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          interpretation?: string | null
          issuer?: string | null
          kind?: string | null
          number?: string | null
          query_term?: string | null
          reg_date?: string | null
          related_articles?: string | null
          scraped_at?: string | null
          source_id: string
          source_name?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          interpretation?: string | null
          issuer?: string | null
          kind?: string | null
          number?: string | null
          query_term?: string | null
          reg_date?: string | null
          related_articles?: string | null
          scraped_at?: string | null
          source_id?: string
          source_name?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
