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
      appointments: {
        Row: {
          cancelled_at: string | null
          contact_id: string
          created_at: string
          ends_at: string
          id: string
          ip: unknown
          manage_token: string
          meeting_type_id: string
          membership_id: string
          opportunity_id: string | null
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          venue_id: string
        }
        Insert: {
          cancelled_at?: string | null
          contact_id: string
          created_at?: string
          ends_at: string
          id?: string
          ip?: unknown
          manage_token?: string
          meeting_type_id: string
          membership_id: string
          opportunity_id?: string | null
          source?: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          venue_id: string
        }
        Update: {
          cancelled_at?: string | null
          contact_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          ip?: unknown
          manage_token?: string
          meeting_type_id?: string
          membership_id?: string
          opportunity_id?: string | null
          source?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_meeting_type_id_fkey"
            columns: ["meeting_type_id"]
            isOneToOne: false
            referencedRelation: "meeting_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          created_at: string
          end_time: string
          id: string
          membership_id: string
          start_time: string
          updated_at: string
          venue_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          membership_id: string
          start_time: string
          updated_at?: string
          venue_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          membership_id?: string
          start_time?: string
          updated_at?: string
          venue_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rules_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_subscriptions: {
        Row: {
          current_period_end: string | null
          id: string
          price_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string
          stripe_subscription_id: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          current_period_end?: string | null
          id?: string
          price_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          current_period_end?: string | null
          id?: string
          price_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
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
          ghl_contact_id: string | null
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
          ghl_contact_id?: string | null
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
          ghl_contact_id?: string | null
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
      couple_accounts: {
        Row: {
          activated_at: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          invited_at: string | null
          last_login_at: string | null
          role: string | null
          status: string
          updated_at: string
          user_id: string | null
          venue_id: string
          wedding_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          invited_at?: string | null
          last_login_at?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          venue_id: string
          wedding_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          invited_at?: string | null
          last_login_at?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          venue_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_accounts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_accounts_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          applies_to: string
          created_at: string
          id: string
          is_archived: boolean
          key: string
          label: string
          options: string[] | null
          sort_order: number
          type: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          applies_to: string
          created_at?: string
          id?: string
          is_archived?: boolean
          key: string
          label: string
          options?: string[] | null
          sort_order?: number
          type: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          applies_to?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          key?: string
          label?: string
          options?: string[] | null
          sort_order?: number
          type?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          contact_id: string
          created_at: string
          enrollment_id: string | null
          id: string
          idempotency_key: string | null
          provider_id: string | null
          status: Database["public"]["Enums"]["email_message_status"]
          step_number: number | null
          subject: string
          venue_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          idempotency_key?: string | null
          provider_id?: string | null
          status?: Database["public"]["Enums"]["email_message_status"]
          step_number?: number | null
          subject: string
          venue_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          idempotency_key?: string | null
          provider_id?: string | null
          status?: Database["public"]["Enums"]["email_message_status"]
          step_number?: number | null
          subject?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_suppressions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_plans: {
        Row: {
          created_at: string
          id: string
          layout: Json
          name: string | null
          space_id: string | null
          template_id: string | null
          updated_at: string
          venue_id: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          layout?: Json
          name?: string | null
          space_id?: string | null
          template_id?: string | null
          updated_at?: string
          venue_id: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          id?: string
          layout?: Json
          name?: string | null
          space_id?: string | null
          template_id?: string | null
          updated_at?: string
          venue_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "floor_plans_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plans_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "floor_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plans_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plans_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_templates: {
        Row: {
          capacity: number | null
          created_at: string
          id: string
          is_default: boolean
          layout: Json | null
          name: string
          space_id: string
          table_count: number | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          id?: string
          is_default?: boolean
          layout?: Json | null
          name: string
          space_id: string
          table_count?: number | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          id?: string
          is_default?: boolean
          layout?: Json | null
          name?: string
          space_id?: string
          table_count?: number | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "floor_templates_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_templates_venue_id_fkey"
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
          ip: unknown
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
          ip?: unknown
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
          ip?: unknown
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
      ghl_credentials: {
        Row: {
          access_token: string | null
          auth_type: string
          created_at: string
          id: string
          location_id: string | null
          refresh_token: string | null
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          access_token?: string | null
          auth_type?: string
          created_at?: string
          id?: string
          location_id?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          access_token?: string | null
          auth_type?: string
          created_at?: string
          id?: string
          location_id?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_credentials_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_webhook_events: {
        Row: {
          created_at: string
          type: string
          venue_id: string
          webhook_id: string
        }
        Insert: {
          created_at?: string
          type: string
          venue_id: string
          webhook_id: string
        }
        Update: {
          created_at?: string
          type?: string
          venue_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_webhook_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_types: {
        Row: {
          buffer_minutes: number
          created_at: string
          duration_minutes: number
          enabled: boolean
          id: string
          kind: Database["public"]["Enums"]["meeting_type_kind"]
          updated_at: string
          venue_id: string
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          duration_minutes?: number
          enabled?: boolean
          id?: string
          kind: Database["public"]["Enums"]["meeting_type_kind"]
          updated_at?: string
          venue_id: string
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          duration_minutes?: number
          enabled?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["meeting_type_kind"]
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_types_venue_id_fkey"
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
      menu_item_selections: {
        Row: {
          course: string | null
          created_at: string
          id: string
          menu_id: string
          menu_item_id: string
          sort_index: number
          venue_id: string
        }
        Insert: {
          course?: string | null
          created_at?: string
          id?: string
          menu_id: string
          menu_item_id: string
          sort_index?: number
          venue_id: string
        }
        Update: {
          course?: string | null
          created_at?: string
          id?: string
          menu_id?: string
          menu_item_id?: string
          sort_index?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_selections_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_selections_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_selections_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string[]
          course: string
          created_at: string
          description: string | null
          dietary_tags: string[]
          id: string
          is_active: boolean
          meal_period: string | null
          name: string
          photo_path: string | null
          price_per_head_minor: number | null
          sort_order: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          allergens?: string[]
          course: string
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          id?: string
          is_active?: boolean
          meal_period?: string | null
          name: string
          photo_path?: string | null
          price_per_head_minor?: number | null
          sort_order?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          allergens?: string[]
          course?: string
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          id?: string
          is_active?: boolean
          meal_period?: string | null
          name?: string
          photo_path?: string | null
          price_per_head_minor?: number | null
          sort_order?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
          venue_id: string
          wedding_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          venue_id: string
          wedding_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          venue_id?: string
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menus_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menus_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          archived_at: string | null
          contact_id: string
          created_at: string
          ghl_opportunity_id: string | null
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
          ghl_opportunity_id?: string | null
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
          ghl_opportunity_id?: string | null
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
      package_lines: {
        Row: {
          category: string
          created_at: string
          id: string
          label: string
          package_id: string
          qty_tied_to_guests: boolean
          sort_order: number
          unit_minor: number
          unit_type: string
          venue_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          label: string
          package_id: string
          qty_tied_to_guests?: boolean
          sort_order?: number
          unit_minor: number
          unit_type: string
          venue_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          label?: string
          package_id?: string
          qty_tied_to_guests?: boolean
          sort_order?: number
          unit_minor?: number
          unit_type?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_lines_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_lines_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          description: string | null
          from_price_minor: number | null
          id: string
          is_active: boolean
          name: string
          season: string | null
          sort_order: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          from_price_minor?: number | null
          id?: string
          is_active?: boolean
          name: string
          season?: string | null
          sort_order?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          from_price_minor?: number | null
          id?: string
          is_active?: boolean
          name?: string
          season?: string | null
          sort_order?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_milestones: {
        Row: {
          amount_minor: number
          created_at: string
          due_date: string
          ghl_invoice_id: string | null
          id: string
          label: string
          paid_on: string | null
          proposal_id: string | null
          receipt_url: string | null
          reminder_sent: boolean
          reminder_sent_at: string | null
          sort_order: number
          status: string
          updated_at: string
          venue_id: string
          wedding_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          due_date: string
          ghl_invoice_id?: string | null
          id?: string
          label: string
          paid_on?: string | null
          proposal_id?: string | null
          receipt_url?: string | null
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          venue_id: string
          wedding_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          due_date?: string
          ghl_invoice_id?: string | null
          id?: string
          label?: string
          paid_on?: string | null
          proposal_id?: string | null
          receipt_url?: string | null
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          venue_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_milestones_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_milestones_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_milestones_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_line_items: {
        Row: {
          category: string
          created_at: string
          discount_pct: number | null
          id: string
          label: string
          package_line_id: string | null
          proposal_id: string
          qty: number
          qty_tied_to_guests: boolean
          sort_order: number
          unit_minor: number
          unit_type: string
          venue_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          discount_pct?: number | null
          id?: string
          label: string
          package_line_id?: string | null
          proposal_id: string
          qty?: number
          qty_tied_to_guests?: boolean
          sort_order?: number
          unit_minor: number
          unit_type?: string
          venue_id: string
        }
        Update: {
          category?: string
          created_at?: string
          discount_pct?: number | null
          id?: string
          label?: string
          package_line_id?: string | null
          proposal_id?: string
          qty?: number
          qty_tied_to_guests?: boolean
          sort_order?: number
          unit_minor?: number
          unit_type?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_line_items_package_line_id_fkey"
            columns: ["package_line_id"]
            isOneToOne: false
            referencedRelation: "package_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_line_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_line_items_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          accepted_at: string | null
          contact_id: string | null
          created_at: string
          deposit_pct: number
          discount_type: string | null
          discount_value_minor: number | null
          ghl_opportunity_id: string | null
          hold_until: string | null
          id: string
          notes: string | null
          sent_at: string | null
          sent_channel: string | null
          status: string
          subtotal_minor: number | null
          template_id: string | null
          total_minor: number | null
          updated_at: string
          vat_pct: number | null
          venue_id: string
          viewed_at: string | null
          wedding_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          contact_id?: string | null
          created_at?: string
          deposit_pct?: number
          discount_type?: string | null
          discount_value_minor?: number | null
          ghl_opportunity_id?: string | null
          hold_until?: string | null
          id?: string
          notes?: string | null
          sent_at?: string | null
          sent_channel?: string | null
          status?: string
          subtotal_minor?: number | null
          template_id?: string | null
          total_minor?: number | null
          updated_at?: string
          vat_pct?: number | null
          venue_id: string
          viewed_at?: string | null
          wedding_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          contact_id?: string | null
          created_at?: string
          deposit_pct?: number
          discount_type?: string | null
          discount_value_minor?: number | null
          ghl_opportunity_id?: string | null
          hold_until?: string | null
          id?: string
          notes?: string | null
          sent_at?: string | null
          sent_channel?: string | null
          status?: string
          subtotal_minor?: number | null
          template_id?: string | null
          total_minor?: number | null
          updated_at?: string
          vat_pct?: number | null
          venue_id?: string
          viewed_at?: string | null
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_enrollments: {
        Row: {
          contact_id: string
          created_at: string
          current_step: number
          id: string
          opportunity_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          stopped_reason: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          current_step?: number
          id?: string
          opportunity_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          stopped_reason?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          current_step?: number
          id?: string
          opportunity_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          stopped_reason?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          body: string
          created_at: string
          delay_hours: number
          enabled: boolean
          id: string
          sequence_id: string
          step_number: number
          subject: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          body: string
          created_at?: string
          delay_hours?: number
          enabled?: boolean
          id?: string
          sequence_id: string
          step_number: number
          subject: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          body?: string
          created_at?: string
          delay_hours?: number
          enabled?: boolean
          id?: string
          sequence_id?: string
          step_number?: number
          subject?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequences_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          capacity_ceremony: number | null
          capacity_seated: number | null
          capacity_standing: number | null
          created_at: string
          description: string | null
          id: string
          indoor_outdoor: string
          is_archived: boolean
          name: string
          photo_path: string | null
          sort_order: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          capacity_ceremony?: number | null
          capacity_seated?: number | null
          capacity_standing?: number | null
          created_at?: string
          description?: string | null
          id?: string
          indoor_outdoor?: string
          is_archived?: boolean
          name: string
          photo_path?: string | null
          sort_order?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          capacity_ceremony?: number | null
          capacity_seated?: number | null
          capacity_standing?: number | null
          created_at?: string
          description?: string | null
          id?: string
          indoor_outdoor?: string
          is_archived?: boolean
          name?: string
          photo_path?: string | null
          sort_order?: number
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
      stripe_events: {
        Row: {
          created_at: string
          event_id: string
          type: string
        }
        Insert: {
          created_at?: string
          event_id: string
          type: string
        }
        Update: {
          created_at?: string
          event_id?: string
          type?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          avg_rating: number | null
          category: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tags: string[]
          updated_at: string
          venue_approved: boolean
          venue_id: string
          website: string | null
        }
        Insert: {
          avg_rating?: number | null
          category: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tags?: string[]
          updated_at?: string
          venue_approved?: boolean
          venue_id: string
          website?: string | null
        }
        Update: {
          avg_rating?: number | null
          category?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tags?: string[]
          updated_at?: string
          venue_approved?: boolean
          venue_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          category: string
          created_at: string
          done: boolean
          duration_min: number
          id: string
          notes: string | null
          owner: string | null
          sort_order: number
          starts_at_time: string
          supplier_id: string | null
          title: string
          updated_at: string
          venue_id: string
          wedding_id: string
        }
        Insert: {
          category: string
          created_at?: string
          done?: boolean
          duration_min?: number
          id?: string
          notes?: string | null
          owner?: string | null
          sort_order?: number
          starts_at_time: string
          supplier_id?: string | null
          title: string
          updated_at?: string
          venue_id: string
          wedding_id: string
        }
        Update: {
          category?: string
          created_at?: string
          done?: boolean
          duration_min?: number
          id?: string
          notes?: string | null
          owner?: string | null
          sort_order?: number
          starts_at_time?: string
          supplier_id?: string | null
          title?: string
          updated_at?: string
          venue_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_timeline_events_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "wedding_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
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
            isOneToOne: true
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
          accent_seed: string
          address: string | null
          created_at: string
          id: string
          legal_name: string | null
          logo_path: string | null
          mode: string
          name: string
          onboarding_completed_at: string | null
          onboarding_step: number
          phone: string | null
          slug: string
          tagline: string | null
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          accent_seed?: string
          address?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          mode?: string
          name: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          phone?: string | null
          slug: string
          tagline?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          accent_seed?: string
          address?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          mode?: string
          name?: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          phone?: string | null
          slug?: string
          tagline?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      wedding_documents: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          kind: string | null
          last_chased_at: string | null
          name: string | null
          signed_at: string | null
          storage_path: string
          supplier_id: string | null
          updated_at: string
          uploaded_by: string | null
          venue_id: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          kind?: string | null
          last_chased_at?: string | null
          name?: string | null
          signed_at?: string | null
          storage_path: string
          supplier_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          venue_id: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          kind?: string | null
          last_chased_at?: string | null
          name?: string | null
          signed_at?: string | null
          storage_path?: string
          supplier_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          venue_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_documents_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_documents_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_guests: {
        Row: {
          allergen_notes: string | null
          created_at: string
          dietary: string[]
          email: string | null
          household_id: string | null
          household_name: string | null
          id: string
          meal_choice: Json | null
          name: string
          notes: string | null
          phone: string | null
          plus_one: boolean
          plus_one_name: string | null
          rsvp: string
          rsvp_chased_at: string | null
          seat_index: number | null
          session_type: string | null
          side: string | null
          table_number: number | null
          tags: string[]
          updated_at: string
          venue_id: string
          wedding_id: string
        }
        Insert: {
          allergen_notes?: string | null
          created_at?: string
          dietary?: string[]
          email?: string | null
          household_id?: string | null
          household_name?: string | null
          id?: string
          meal_choice?: Json | null
          name: string
          notes?: string | null
          phone?: string | null
          plus_one?: boolean
          plus_one_name?: string | null
          rsvp?: string
          rsvp_chased_at?: string | null
          seat_index?: number | null
          session_type?: string | null
          side?: string | null
          table_number?: number | null
          tags?: string[]
          updated_at?: string
          venue_id: string
          wedding_id: string
        }
        Update: {
          allergen_notes?: string | null
          created_at?: string
          dietary?: string[]
          email?: string | null
          household_id?: string | null
          household_name?: string | null
          id?: string
          meal_choice?: Json | null
          name?: string
          notes?: string | null
          phone?: string | null
          plus_one?: boolean
          plus_one_name?: string | null
          rsvp?: string
          rsvp_chased_at?: string | null
          seat_index?: number | null
          session_type?: string | null
          side?: string | null
          table_number?: number | null
          tags?: string[]
          updated_at?: string
          venue_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_guests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_guests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_menu_selections: {
        Row: {
          course: string | null
          created_at: string
          id: string
          menu_item_id: string
          sort_index: number
          updated_at: string
          venue_id: string
          wedding_id: string
        }
        Insert: {
          course?: string | null
          created_at?: string
          id?: string
          menu_item_id: string
          sort_index?: number
          updated_at?: string
          venue_id: string
          wedding_id: string
        }
        Update: {
          course?: string | null
          created_at?: string
          id?: string
          menu_item_id?: string
          sort_index?: number
          updated_at?: string
          venue_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_menu_selections_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_menu_selections_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_menu_selections_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_suppliers: {
        Row: {
          arrival_time: string | null
          category: string
          checked_in_at: string | null
          contact_name: string | null
          created_at: string
          docs_received: number
          docs_required: number
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          status: string
          supplier_id: string | null
          tags: string[]
          updated_at: string
          venue_id: string
          wedding_id: string
        }
        Insert: {
          arrival_time?: string | null
          category: string
          checked_in_at?: string | null
          contact_name?: string | null
          created_at?: string
          docs_received?: number
          docs_required?: number
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          supplier_id?: string | null
          tags?: string[]
          updated_at?: string
          venue_id: string
          wedding_id: string
        }
        Update: {
          arrival_time?: string | null
          category?: string
          checked_in_at?: string | null
          contact_name?: string | null
          created_at?: string
          docs_received?: number
          docs_required?: number
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          supplier_id?: string | null
          tags?: string[]
          updated_at?: string
          venue_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_suppliers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_suppliers_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_tasks: {
        Row: {
          category: string
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          owner: string | null
          sort_index: number
          title: string
          updated_at: string
          venue_id: string
          visible_to_couple: boolean
          wedding_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          owner?: string | null
          sort_index?: number
          title: string
          updated_at?: string
          venue_id: string
          visible_to_couple?: boolean
          wedding_id: string
        }
        Update: {
          category?: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          owner?: string | null
          sort_index?: number
          title?: string
          updated_at?: string
          venue_id?: string
          visible_to_couple?: boolean
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_tasks_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_tasks_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      weddings: {
        Row: {
          contact_id: string | null
          contract_status: string
          coordinator_membership_id: string | null
          couple_names: string
          created_at: string
          custom: Json
          ghl_contact_id: string | null
          ghl_opportunity_id: string | null
          guest_count_day: number | null
          guest_count_evening: number | null
          id: string
          menu_id: string | null
          notes: string | null
          opportunity_id: string | null
          package_id: string | null
          package_name: string | null
          portal_active: boolean
          portal_last_seen_at: string | null
          source: string
          space_id: string | null
          status: string
          total_value_minor: number | null
          updated_at: string
          venue_id: string
          wedding_date: string | null
        }
        Insert: {
          contact_id?: string | null
          contract_status?: string
          coordinator_membership_id?: string | null
          couple_names: string
          created_at?: string
          custom?: Json
          ghl_contact_id?: string | null
          ghl_opportunity_id?: string | null
          guest_count_day?: number | null
          guest_count_evening?: number | null
          id?: string
          menu_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          package_id?: string | null
          package_name?: string | null
          portal_active?: boolean
          portal_last_seen_at?: string | null
          source?: string
          space_id?: string | null
          status?: string
          total_value_minor?: number | null
          updated_at?: string
          venue_id: string
          wedding_date?: string | null
        }
        Update: {
          contact_id?: string | null
          contract_status?: string
          coordinator_membership_id?: string | null
          couple_names?: string
          created_at?: string
          custom?: Json
          ghl_contact_id?: string | null
          ghl_opportunity_id?: string | null
          guest_count_day?: number | null
          guest_count_evening?: number | null
          id?: string
          menu_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          package_id?: string | null
          package_name?: string | null
          portal_active?: boolean
          portal_last_seen_at?: string | null
          source?: string
          space_id?: string | null
          status?: string
          total_value_minor?: number | null
          updated_at?: string
          venue_id?: string
          wedding_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_weddings_menu_id"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_weddings_package_id"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weddings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weddings_coordinator_membership_id_fkey"
            columns: ["coordinator_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weddings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weddings_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weddings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      report_leads_by_source: {
        Row: {
          lead_count: number | null
          source: string | null
          venue_id: string | null
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
      report_leads_by_stage: {
        Row: {
          lead_count: number | null
          stage: Database["public"]["Enums"]["pipeline_stage"] | null
          venue_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
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
          ghl_contact_id: string | null
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
          accent_seed: string
          address: string | null
          created_at: string
          id: string
          legal_name: string | null
          logo_path: string | null
          mode: string
          name: string
          onboarding_completed_at: string | null
          onboarding_step: number
          phone: string | null
          slug: string
          tagline: string | null
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
      current_couple_wedding_ids: { Args: never; Returns: string[] }
      current_owner_or_admin_venue_ids: { Args: never; Returns: string[] }
      current_owner_venue_ids: { Args: never; Returns: string[] }
      current_venue_ids: { Args: never; Returns: string[] }
      get_or_create_sequence: {
        Args: { p_venue_id: string }
        Returns: {
          created_at: string
          enabled: boolean
          id: string
          updated_at: string
          venue_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sequences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_active_brochure: {
        Args: { p_file_path: string; p_title?: string; p_venue_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "brochures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reschedule_appointment: {
        Args: { p_ends_at: string; p_manage_token: string; p_starts_at: string }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      appointment_status: "booked" | "attended" | "no_show" | "cancelled"
      email_message_status: "sent" | "skipped" | "failed"
      enrollment_status: "active" | "completed" | "stopped"
      meeting_type_kind: "viewing" | "call"
      pipeline_stage:
        | "inbound_enquiry"
        | "responded"
        | "viewing_interest"
        | "appointment_booked"
        | "appointment_attended"
        | "date_on_hold"
        | "wedding_booked"
        | "archived"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
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
      appointment_status: ["booked", "attended", "no_show", "cancelled"],
      email_message_status: ["sent", "skipped", "failed"],
      enrollment_status: ["active", "completed", "stopped"],
      meeting_type_kind: ["viewing", "call"],
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
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
      ],
    },
  },
} as const
