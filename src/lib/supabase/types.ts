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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      brochures: {
        Row: {
          created_at: string
          download_count: number
          download_token: string
          file_path: string
          id: string
          is_active: boolean
          last_downloaded_at: string | null
          title: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          download_count?: number
          download_token?: string
          file_path: string
          id?: string
          is_active?: boolean
          last_downloaded_at?: string | null
          title?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          download_count?: number
          download_token?: string
          file_path?: string
          id?: string
          is_active?: boolean
          last_downloaded_at?: string | null
          title?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brochures_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          budget_minor: number | null
          created_at: string
          custom: Json
          email: string | null
          email_status: string
          first_name: string
          guest_count: number | null
          id: string
          last_name: string | null
          partner_first_name: string | null
          partner_last_name: string | null
          phone: string | null
          source: string | null
          updated_at: string
          venue_id: string
          wedding_date: string | null
          wedding_date_flexible: boolean
        }
        Insert: {
          budget_minor?: number | null
          created_at?: string
          custom?: Json
          email?: string | null
          email_status?: string
          first_name: string
          guest_count?: number | null
          id?: string
          last_name?: string | null
          partner_first_name?: string | null
          partner_last_name?: string | null
          phone?: string | null
          source?: string | null
          updated_at?: string
          venue_id: string
          wedding_date?: string | null
          wedding_date_flexible?: boolean
        }
        Update: {
          budget_minor?: number | null
          created_at?: string
          custom?: Json
          email?: string | null
          email_status?: string
          first_name?: string
          guest_count?: number | null
          id?: string
          last_name?: string | null
          partner_first_name?: string | null
          partner_last_name?: string | null
          phone?: string | null
          source?: string | null
          updated_at?: string
          venue_id?: string
          wedding_date?: string | null
          wedding_date_flexible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contacts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          ip: unknown | null
          payload: Json
          processed_at: string | null
          referrer: string | null
          utm: Json | null
          venue_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          ip?: unknown | null
          payload: Json
          processed_at?: string | null
          referrer?: string | null
          utm?: Json | null
          venue_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          ip?: unknown | null
          payload?: Json
          processed_at?: string | null
          referrer?: string | null
          utm?: Json | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          role: string
          updated_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          updated_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          archived_at: string | null
          contact_id: string
          created_at: string
          id: string
          sort_index: number
          stage: Database["public"]["Enums"]["pipeline_stage"]
          updated_at: string
          venue_id: string
        }
        Insert: {
          archived_at?: string | null
          contact_id: string
          created_at?: string
          id?: string
          sort_index?: number
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          updated_at?: string
          venue_id: string
        }
        Update: {
          archived_at?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          sort_index?: number
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          capacity_seated: number | null
          capacity_standing: number | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          capacity_seated?: number | null
          capacity_standing?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          capacity_seated?: number | null
          capacity_standing?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_events: {
        Row: {
          changed_by: string | null
          from_stage: Database["public"]["Enums"]["pipeline_stage"] | null
          id: string
          occurred_at: string
          opportunity_id: string
          to_stage: Database["public"]["Enums"]["pipeline_stage"]
          venue_id: string
        }
        Insert: {
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          id?: string
          occurred_at?: string
          opportunity_id: string
          to_stage: Database["public"]["Enums"]["pipeline_stage"]
          venue_id: string
        }
        Update: {
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          id?: string
          occurred_at?: string
          opportunity_id?: string
          to_stage?: Database["public"]["Enums"]["pipeline_stage"]
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_events_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_email_settings: {
        Row: {
          created_at: string
          from_name: string | null
          id: string
          reply_to: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          from_name?: string | null
          id?: string
          reply_to?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          from_name?: string | null
          id?: string
          reply_to?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_email_settings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_hours: {
        Row: {
          close_time: string | null
          created_at: string
          id: string
          open_time: string | null
          updated_at: string
          venue_id: string
          weekday: number
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          id?: string
          open_time?: string | null
          updated_at?: string
          venue_id: string
          weekday: number
        }
        Update: {
          close_time?: string | null
          created_at?: string
          id?: string
          open_time?: string | null
          updated_at?: string
          venue_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_hours_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          created_at: string
          id: string
          logo_path: string | null
          name: string
          onboarding_completed_at: string | null
          onboarding_step: number
          slug: string
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          slug: string
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          slug?: string
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_contact_with_opportunity: {
        Args: {
          p_budget_minor?: number
          p_email?: string
          p_first_name: string
          p_guest_count?: number
          p_last_name?: string
          p_partner_first_name?: string
          p_partner_last_name?: string
          p_phone?: string
          p_source?: string
          p_venue_id: string
          p_wedding_date?: string
          p_wedding_date_flexible?: boolean
        }
        Returns: {
          budget_minor: number | null
          created_at: string
          custom: Json
          email: string | null
          email_status: string
          first_name: string
          guest_count: number | null
          id: string
          last_name: string | null
          partner_first_name: string | null
          partner_last_name: string | null
          phone: string | null
          source: string | null
          updated_at: string
          venue_id: string
          wedding_date: string | null
          wedding_date_flexible: boolean
        }
        SetofOptions: {
          from: "*"
          to: "contacts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_venue_with_owner: {
        Args: { p_name: string; p_slug: string }
        Returns: {
          created_at: string
          id: string
          logo_path: string | null
          name: string
          onboarding_completed_at: string | null
          onboarding_step: number
          slug: string
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "venues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_owner_or_admin_venue_ids: { Args: never; Returns: string[] }
      current_owner_venue_ids: { Args: never; Returns: string[] }
      current_venue_ids: { Args: never; Returns: string[] }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      pipeline_stage:
        | "inbound_enquiry"
        | "responded"
        | "viewing_interest"
        | "appointment_booked"
        | "appointment_attended"
        | "date_on_hold"
        | "wedding_booked"
        | "archived"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      pipeline_stage: [
        "inbound_enquiry",
        "responded",
        "viewing_interest",
        "appointment_booked",
        "appointment_attended",
        "date_on_hold",
        "wedding_booked",
        "archived",
      ],
    },
  },
} as const
