export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      accommodation_categories: {
        Row: {
          base_price_suggestion: number | null
          code: string | null
          created_at: string
          created_by: string | null
          default_bed_count: number
          default_capacity: number
          description: string
          display_order: number
          id: string
          max_capacity: number | null
          name: string
          pousada_id: string
          status: Database['public']['Enums']['accommodation_status']
          updated_at: string
        }
        Insert: {
          base_price_suggestion?: number | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          default_bed_count?: number
          default_capacity?: number
          description?: string
          display_order?: number
          id?: string
          max_capacity?: number | null
          name: string
          pousada_id: string
          status?: Database['public']['Enums']['accommodation_status']
          updated_at?: string
        }
        Update: {
          base_price_suggestion?: number | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          default_bed_count?: number
          default_capacity?: number
          description?: string
          display_order?: number
          id?: string
          max_capacity?: number | null
          name?: string
          pousada_id?: string
          status?: Database['public']['Enums']['accommodation_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'accommodation_categories_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'accommodation_categories_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
        ]
      }
      amenities: {
        Row: {
          category: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      availability: {
        Row: {
          date: string
          id: string
          price: number | null
          room_id: string
          status: string
        }
        Insert: {
          date: string
          id?: string
          price?: number | null
          room_id: string
          status?: string
        }
        Update: {
          date?: string
          id?: string
          price?: number | null
          room_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'availability_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      booking_guests: {
        Row: {
          birth_date: string | null
          booking_id: string
          created_at: string
          document_number: string | null
          document_type: string | null
          full_name: string
          guest_id: string | null
          guest_type: Database['public']['Enums']['booking_guest_type']
          has_special_needs: boolean
          id: string
          operational_notes: string
        }
        Insert: {
          birth_date?: string | null
          booking_id: string
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          full_name: string
          guest_id?: string | null
          guest_type: Database['public']['Enums']['booking_guest_type']
          has_special_needs?: boolean
          id?: string
          operational_notes?: string
        }
        Update: {
          birth_date?: string | null
          booking_id?: string
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          full_name?: string
          guest_id?: string | null
          guest_type?: Database['public']['Enums']['booking_guest_type']
          has_special_needs?: boolean
          id?: string
          operational_notes?: string
        }
        Relationships: [
          {
            foreignKeyName: 'booking_guests_booking_id_fkey'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'booking_guests_guest_id_fkey'
            columns: ['guest_id']
            isOneToOne: false
            referencedRelation: 'guests'
            referencedColumns: ['id']
          },
        ]
      }
      bookings: {
        Row: {
          adults: number
          amount_received: number
          balance_due: number | null
          cancellation_policy_snapshot: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          checked_out_at: string | null
          checked_out_by: string | null
          checkin: string
          checkin_reminder_sent_at: string | null
          checkout: string
          children: number
          code: string
          created_at: string
          created_by: string | null
          currency: string
          discount: number
          expected_arrival_time: string | null
          expected_commission: number | null
          external_channel_name: string | null
          external_code: string | null
          fee: number
          guest_email: string | null
          guest_id: string | null
          guest_name: string | null
          guest_phone: string | null
          guests: number | null
          id: string
          infants: number
          internal_notes: string
          no_show_at: string | null
          no_show_by: string | null
          no_show_reason: string | null
          origin: Database['public']['Enums']['booking_origin']
          payment_due_at: string | null
          pets: boolean
          pousada_id: string
          responsible_guest_id: string
          room_id: string
          services_amount: number
          special_requests: string
          status: Database['public']['Enums']['booking_status']
          stay_range: unknown
          subtotal: number
          surcharge: number
          total: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          adults?: number
          amount_received?: number
          balance_due?: number | null
          cancellation_policy_snapshot?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          checkin: string
          checkin_reminder_sent_at?: string | null
          checkout: string
          children?: number
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount?: number
          expected_arrival_time?: string | null
          expected_commission?: number | null
          external_channel_name?: string | null
          external_code?: string | null
          fee?: number
          guest_email?: string | null
          guest_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guests?: number | null
          id?: string
          infants?: number
          internal_notes?: string
          no_show_at?: string | null
          no_show_by?: string | null
          no_show_reason?: string | null
          origin?: Database['public']['Enums']['booking_origin']
          payment_due_at?: string | null
          pets?: boolean
          pousada_id: string
          responsible_guest_id: string
          room_id: string
          services_amount?: number
          special_requests?: string
          status?: Database['public']['Enums']['booking_status']
          stay_range?: unknown
          subtotal?: number
          surcharge?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          adults?: number
          amount_received?: number
          balance_due?: number | null
          cancellation_policy_snapshot?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          checkin?: string
          checkin_reminder_sent_at?: string | null
          checkout?: string
          children?: number
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount?: number
          expected_arrival_time?: string | null
          expected_commission?: number | null
          external_channel_name?: string | null
          external_code?: string | null
          fee?: number
          guest_email?: string | null
          guest_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guests?: number | null
          id?: string
          infants?: number
          internal_notes?: string
          no_show_at?: string | null
          no_show_by?: string | null
          no_show_reason?: string | null
          origin?: Database['public']['Enums']['booking_origin']
          payment_due_at?: string | null
          pets?: boolean
          pousada_id?: string
          responsible_guest_id?: string
          room_id?: string
          services_amount?: number
          special_requests?: string
          status?: Database['public']['Enums']['booking_status']
          stay_range?: unknown
          subtotal?: number
          surcharge?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'bookings_cancelled_by_fkey'
            columns: ['cancelled_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_checked_in_by_fkey'
            columns: ['checked_in_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_checked_out_by_fkey'
            columns: ['checked_out_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_guest_id_fkey'
            columns: ['guest_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_no_show_by_fkey'
            columns: ['no_show_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_responsible_guest_id_fkey'
            columns: ['responsible_guest_id']
            isOneToOne: false
            referencedRelation: 'guests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      channel_calendars: {
        Row: {
          created_at: string
          created_by: string | null
          export_enabled: boolean
          export_token: string
          id: string
          import_enabled: boolean
          import_url: string | null
          label: string
          last_event_count: number
          last_sync_at: string | null
          last_sync_error: string
          last_sync_status: Database['public']['Enums']['channel_sync_status']
          pousada_id: string
          provider: Database['public']['Enums']['channel_provider']
          room_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          export_enabled?: boolean
          export_token: string
          id?: string
          import_enabled?: boolean
          import_url?: string | null
          label?: string
          last_event_count?: number
          last_sync_at?: string | null
          last_sync_error?: string
          last_sync_status?: Database['public']['Enums']['channel_sync_status']
          pousada_id: string
          provider: Database['public']['Enums']['channel_provider']
          room_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          export_enabled?: boolean
          export_token?: string
          id?: string
          import_enabled?: boolean
          import_url?: string | null
          label?: string
          last_event_count?: number
          last_sync_at?: string | null
          last_sync_error?: string
          last_sync_status?: Database['public']['Enums']['channel_sync_status']
          pousada_id?: string
          provider?: Database['public']['Enums']['channel_provider']
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'channel_calendars_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'channel_calendars_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'channel_calendars_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      channel_events: {
        Row: {
          calendar_id: string
          created_at: string
          ends_on: string
          id: string
          pousada_id: string
          room_id: string
          starts_on: string
          summary: string
          uid: string
          updated_at: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          ends_on: string
          id?: string
          pousada_id: string
          room_id: string
          starts_on: string
          summary?: string
          uid: string
          updated_at?: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          pousada_id?: string
          room_id?: string
          starts_on?: string
          summary?: string
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'channel_events_calendar_id_fkey'
            columns: ['calendar_id']
            isOneToOne: false
            referencedRelation: 'channel_calendars'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'channel_events_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'channel_events_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      cities: {
        Row: {
          id: string
          name: string
          state_id: string
        }
        Insert: {
          id?: string
          name: string
          state_id: string
        }
        Update: {
          id?: string
          name?: string
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cities_state_id_fkey'
            columns: ['state_id']
            isOneToOne: false
            referencedRelation: 'states'
            referencedColumns: ['id']
          },
        ]
      }
      destinations: {
        Row: {
          created_at: string
          id: string
          image: string
          name: string
          pousadas_count: number
          price_from: number
          rating: number
          season: string[]
          slug: string
          state: string
        }
        Insert: {
          created_at?: string
          id?: string
          image: string
          name: string
          pousadas_count?: number
          price_from?: number
          rating?: number
          season?: string[]
          slug: string
          state: string
        }
        Update: {
          created_at?: string
          id?: string
          image?: string
          name?: string
          pousadas_count?: number
          price_from?: number
          rating?: number
          season?: string[]
          slug?: string
          state?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          due_date: string | null
          id: string
          paid: boolean
          pousada_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          paid?: boolean
          pousada_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          paid?: boolean
          pousada_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
        ]
      }
      experiences: {
        Row: {
          description: string
          icon: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          description?: string
          icon: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          description?: string
          icon?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      favorite_alerts: {
        Row: {
          alert_kind: string
          channels: string[]
          created_at: string
          max_price: number | null
          pousada_id: string
          status: string
          target_season: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_kind?: string
          channels?: string[]
          created_at?: string
          max_price?: number | null
          pousada_id: string
          status?: string
          target_season?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_kind?: string
          channels?: string[]
          created_at?: string
          max_price?: number | null
          pousada_id?: string
          status?: string
          target_season?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'favorite_alerts_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'favorite_alerts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          pousada_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          pousada_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          pousada_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'favorites_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'favorites_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      guests: {
        Row: {
          accessibility_needs: string
          address: string | null
          birth_date: string | null
          cep: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          dietary_restrictions: string
          document_last4: string | null
          document_number: string | null
          document_number_hash: string | null
          document_type: string | null
          email: string | null
          email_normalized: string | null
          emergency_contact: Json
          full_name: string
          id: string
          internal_notes: string
          marketing_consent: boolean
          nationality: string | null
          phone: string | null
          phone_normalized: string | null
          pousada_id: string
          preferences: string[]
          preferred_name: string | null
          source: Database['public']['Enums']['guest_source']
          state: string | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          accessibility_needs?: string
          address?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          dietary_restrictions?: string
          document_last4?: string | null
          document_number?: string | null
          document_number_hash?: string | null
          document_type?: string | null
          email?: string | null
          email_normalized?: string | null
          emergency_contact?: Json
          full_name: string
          id?: string
          internal_notes?: string
          marketing_consent?: boolean
          nationality?: string | null
          phone?: string | null
          phone_normalized?: string | null
          pousada_id: string
          preferences?: string[]
          preferred_name?: string | null
          source?: Database['public']['Enums']['guest_source']
          state?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          accessibility_needs?: string
          address?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          dietary_restrictions?: string
          document_last4?: string | null
          document_number?: string | null
          document_number_hash?: string | null
          document_type?: string | null
          email?: string | null
          email_normalized?: string | null
          emergency_contact?: Json
          full_name?: string
          id?: string
          internal_notes?: string
          marketing_consent?: boolean
          nationality?: string | null
          phone?: string | null
          phone_normalized?: string | null
          pousada_id?: string
          preferences?: string[]
          preferred_name?: string | null
          source?: Database['public']['Enums']['guest_source']
          state?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'guests_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guests_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guests_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          id: string
          mp_payment_id: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: string
          subscription_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          mp_payment_id?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          mp_payment_id?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_subscription_id_fkey'
            columns: ['subscription_id']
            isOneToOne: false
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          },
        ]
      }
      link_events: {
        Row: {
          available_count: number | null
          checkin: string | null
          checkout: string | null
          created_at: string
          event: Database['public']['Enums']['link_event_type']
          guests: number | null
          id: string
          pousada_id: string
        }
        Insert: {
          available_count?: number | null
          checkin?: string | null
          checkout?: string | null
          created_at?: string
          event: Database['public']['Enums']['link_event_type']
          guests?: number | null
          id?: string
          pousada_id: string
        }
        Update: {
          available_count?: number | null
          checkin?: string | null
          checkout?: string | null
          created_at?: string
          event?: Database['public']['Enums']['link_event_type']
          guests?: number | null
          id?: string
          pousada_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'link_events_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip?: string | null
          success: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
          success?: boolean
        }
        Relationships: []
      }
      media: {
        Row: {
          alt: string
          id: string
          kind: string
          position: number
          pousada_id: string
          room_id: string | null
          url: string
        }
        Insert: {
          alt?: string
          id?: string
          kind?: string
          position?: number
          pousada_id: string
          room_id?: string | null
          url: string
        }
        Update: {
          alt?: string
          id?: string
          kind?: string
          position?: number
          pousada_id?: string
          room_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'media_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      memberships: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          id: string
          invited_at: string | null
          pousada_id: string
          role: Database['public']['Enums']['user_role']
          status: Database['public']['Enums']['membership_status']
          suspended_by: string | null
          suspended_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invited_at?: string | null
          pousada_id: string
          role: Database['public']['Enums']['user_role']
          status?: Database['public']['Enums']['membership_status']
          suspended_by?: string | null
          suspended_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invited_at?: string | null
          pousada_id?: string
          role?: Database['public']['Enums']['user_role']
          status?: Database['public']['Enums']['membership_status']
          suspended_by?: string | null
          suspended_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memberships_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'memberships_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'memberships_suspended_by_fkey'
            columns: ['suspended_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'memberships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      payment_proofs: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string
          pousada_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number
          status: Database['public']['Enums']['payment_proof_status']
          uploaded_by: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          file_name?: string
          file_path: string
          id?: string
          mime_type: string
          pousada_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes: number
          status?: Database['public']['Enums']['payment_proof_status']
          uploaded_by: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string
          pousada_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number
          status?: Database['public']['Enums']['payment_proof_status']
          uploaded_by?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          credited_amount: number
          id: string
          method: string
          provider_ref: string | null
          provider_updated_at: string | null
          refunded_amount: number
          status: Database['public']['Enums']['payment_status']
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          credited_amount?: number
          id?: string
          method: string
          provider_ref?: string | null
          provider_updated_at?: string | null
          refunded_amount?: number
          status?: Database['public']['Enums']['payment_status']
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          credited_amount?: number
          id?: string
          method?: string
          provider_ref?: string | null
          provider_updated_at?: string | null
          refunded_amount?: number
          status?: Database['public']['Enums']['payment_status']
        }
        Relationships: [
          {
            foreignKeyName: 'payments_booking_id_fkey'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          id: string
          mp_preapproval_plan_id: string | null
          name: string
          price: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          mp_preapproval_plan_id?: string | null
          name: string
          price: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          mp_preapproval_plan_id?: string | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      platform_access_grants: {
        Row: {
          expires_at: string
          granted_at: string
          granted_by: string | null
          granted_to: string
          id: string
          pousada_id: string
          reason: string
          revoked_at: string | null
        }
        Insert: {
          expires_at: string
          granted_at?: string
          granted_by?: string | null
          granted_to: string
          id?: string
          pousada_id: string
          reason: string
          revoked_at?: string | null
        }
        Update: {
          expires_at?: string
          granted_at?: string
          granted_by?: string | null
          granted_to?: string
          id?: string
          pousada_id?: string
          reason?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'platform_access_grants_granted_by_fkey'
            columns: ['granted_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'platform_access_grants_granted_to_fkey'
            columns: ['granted_to']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'platform_access_grants_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
        ]
      }
      platform_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          paid: boolean
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          paid?: boolean
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          paid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'platform_expenses_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      pousada_amenities: {
        Row: {
          amenity_id: string
          pousada_id: string
        }
        Insert: {
          amenity_id: string
          pousada_id: string
        }
        Update: {
          amenity_id?: string
          pousada_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pousada_amenities_amenity_id_fkey'
            columns: ['amenity_id']
            isOneToOne: false
            referencedRelation: 'amenities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pousada_amenities_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
        ]
      }
      pousada_experiences: {
        Row: {
          experience_id: string
          pousada_id: string
        }
        Insert: {
          experience_id: string
          pousada_id: string
        }
        Update: {
          experience_id?: string
          pousada_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pousada_experiences_experience_id_fkey'
            columns: ['experience_id']
            isOneToOne: false
            referencedRelation: 'experiences'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pousada_experiences_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
        ]
      }
      pousada_payment_accounts: {
        Row: {
          access_token: string | null
          connected_at: string | null
          connected_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          live_mode: boolean
          mp_user_id: string | null
          pousada_id: string
          provider: string
          public_key: string | null
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          live_mode?: boolean
          mp_user_id?: string | null
          pousada_id: string
          provider?: string
          public_key?: string | null
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          live_mode?: boolean
          mp_user_id?: string | null
          pousada_id?: string
          provider?: string
          public_key?: string | null
          refresh_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pousada_payment_accounts_connected_by_fkey'
            columns: ['connected_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pousada_payment_accounts_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: true
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
        ]
      }
      pousada_pix_settings: {
        Row: {
          city: string
          created_at: string
          enabled: boolean
          holder_name: string
          key_type: string
          pix_key: string
          pousada_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          city: string
          created_at?: string
          enabled?: boolean
          holder_name: string
          key_type: string
          pix_key: string
          pousada_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          enabled?: boolean
          holder_name?: string
          key_type?: string
          pix_key?: string
          pousada_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pousadas: {
        Row: {
          address: string
          cancellation_policy: string
          cep: string | null
          checkin_time: string
          checkout_time: string
          city: string
          contact_phone: string
          country: string
          created_at: string
          currency: string
          description: string
          destination_id: string | null
          gallery: string[]
          house_rules: string
          id: string
          image: string
          instagram: string
          language: string
          legal_name: string
          name: string
          notification_email: string
          owner_id: string | null
          price_per_night: number
          rating: number
          reviews: number
          slug: string
          state: string
          status: Database['public']['Enums']['pousada_status']
          tags: string[]
          tax_id: string
          tenant_status: Database['public']['Enums']['tenant_status']
          timezone: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          address?: string
          cancellation_policy?: string
          cep?: string | null
          checkin_time?: string
          checkout_time?: string
          city: string
          contact_phone?: string
          country?: string
          created_at?: string
          currency?: string
          description?: string
          destination_id?: string | null
          gallery?: string[]
          house_rules?: string
          id?: string
          image?: string
          instagram?: string
          language?: string
          legal_name?: string
          name: string
          notification_email?: string
          owner_id?: string | null
          price_per_night?: number
          rating?: number
          reviews?: number
          slug: string
          state: string
          status?: Database['public']['Enums']['pousada_status']
          tags?: string[]
          tax_id?: string
          tenant_status?: Database['public']['Enums']['tenant_status']
          timezone?: string
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          address?: string
          cancellation_policy?: string
          cep?: string | null
          checkin_time?: string
          checkout_time?: string
          city?: string
          contact_phone?: string
          country?: string
          created_at?: string
          currency?: string
          description?: string
          destination_id?: string | null
          gallery?: string[]
          house_rules?: string
          id?: string
          image?: string
          instagram?: string
          language?: string
          legal_name?: string
          name?: string
          notification_email?: string
          owner_id?: string | null
          price_per_night?: number
          rating?: number
          reviews?: number
          slug?: string
          state?: string
          status?: Database['public']['Enums']['pousada_status']
          tags?: string[]
          tax_id?: string
          tenant_status?: Database['public']['Enums']['tenant_status']
          timezone?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pousadas_destination_id_fkey'
            columns: ['destination_id']
            isOneToOne: false
            referencedRelation: 'destinations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pousadas_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          platform_role: Database['public']['Enums']['platform_role'] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          platform_role?: Database['public']['Enums']['platform_role'] | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          platform_role?: Database['public']['Enums']['platform_role'] | null
          updated_at?: string
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          adults: number
          checkin: string | null
          checkout: string | null
          children: number
          consent: boolean
          created_at: string
          email: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          internal_notes: string
          message: string
          name: string
          occasion: string
          pets: boolean
          phone: string
          pousada_id: string
          status: Database['public']['Enums']['quote_request_status']
          updated_at: string
        }
        Insert: {
          adults?: number
          checkin?: string | null
          checkout?: string | null
          children?: number
          consent?: boolean
          created_at?: string
          email?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          internal_notes?: string
          message?: string
          name: string
          occasion?: string
          pets?: boolean
          phone: string
          pousada_id: string
          status?: Database['public']['Enums']['quote_request_status']
          updated_at?: string
        }
        Update: {
          adults?: number
          checkin?: string | null
          checkout?: string | null
          children?: number
          consent?: boolean
          created_at?: string
          email?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          internal_notes?: string
          message?: string
          name?: string
          occasion?: string
          pets?: boolean
          phone?: string
          pousada_id?: string
          status?: Database['public']['Enums']['quote_request_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quote_requests_handled_by_fkey'
            columns: ['handled_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_requests_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string
          booking_id: string
          created_at: string
          id: string
          pousada_id: string
          rating: number
          response: string | null
          text: string
        }
        Insert: {
          author_id: string
          booking_id: string
          created_at?: string
          id?: string
          pousada_id: string
          rating: number
          response?: string | null
          text?: string
        }
        Update: {
          author_id?: string
          booking_id?: string
          created_at?: string
          id?: string
          pousada_id?: string
          rating?: number
          response?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reviews_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reviews_booking_id_fkey'
            columns: ['booking_id']
            isOneToOne: true
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reviews_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
        ]
      }
      room_amenities: {
        Row: {
          amenity_id: string
          room_id: string
        }
        Insert: {
          amenity_id: string
          room_id: string
        }
        Update: {
          amenity_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'room_amenities_amenity_id_fkey'
            columns: ['amenity_id']
            isOneToOne: false
            referencedRelation: 'amenities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'room_amenities_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      room_blocks: {
        Row: {
          block_type: Database['public']['Enums']['room_block_type']
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          notes: string
          pousada_id: string
          reason: string
          room_id: string
          source: string
          starts_at: string
          status: Database['public']['Enums']['room_block_status']
        }
        Insert: {
          block_type: Database['public']['Enums']['room_block_type']
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          notes?: string
          pousada_id: string
          reason: string
          room_id: string
          source?: string
          starts_at: string
          status?: Database['public']['Enums']['room_block_status']
        }
        Update: {
          block_type?: Database['public']['Enums']['room_block_type']
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          notes?: string
          pousada_id?: string
          reason?: string
          room_id?: string
          source?: string
          starts_at?: string
          status?: Database['public']['Enums']['room_block_status']
        }
        Relationships: [
          {
            foreignKeyName: 'room_blocks_cancelled_by_fkey'
            columns: ['cancelled_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'room_blocks_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'room_blocks_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'room_blocks_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      rooms: {
        Row: {
          accessible: boolean
          adults_max: number | null
          base_price: number
          bed_config: Json
          capacity: number
          capacity_max: number | null
          category_id: string | null
          children_max: number
          code: string | null
          created_at: string
          created_by: string | null
          description: string
          display_order: number
          id: string
          infants_allowed: boolean
          internal_notes: string
          location: string
          name: string
          operational_description: string
          operational_status: Database['public']['Enums']['room_operational_status']
          pets_allowed: boolean
          pousada_id: string
          public_visible: boolean
          size: string | null
          status: Database['public']['Enums']['accommodation_status']
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accessible?: boolean
          adults_max?: number | null
          base_price?: number
          bed_config?: Json
          capacity?: number
          capacity_max?: number | null
          category_id?: string | null
          children_max?: number
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          display_order?: number
          id?: string
          infants_allowed?: boolean
          internal_notes?: string
          location?: string
          name: string
          operational_description?: string
          operational_status?: Database['public']['Enums']['room_operational_status']
          pets_allowed?: boolean
          pousada_id: string
          public_visible?: boolean
          size?: string | null
          status?: Database['public']['Enums']['accommodation_status']
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accessible?: boolean
          adults_max?: number | null
          base_price?: number
          bed_config?: Json
          capacity?: number
          capacity_max?: number | null
          category_id?: string | null
          children_max?: number
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          display_order?: number
          id?: string
          infants_allowed?: boolean
          internal_notes?: string
          location?: string
          name?: string
          operational_description?: string
          operational_status?: Database['public']['Enums']['room_operational_status']
          pets_allowed?: boolean
          pousada_id?: string
          public_visible?: boolean
          size?: string | null
          status?: Database['public']['Enums']['accommodation_status']
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'rooms_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'accommodation_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rooms_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rooms_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: false
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rooms_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      states: {
        Row: {
          code: string
          id: string
          name: string
        }
        Insert: {
          code: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          mp_preapproval_id: string | null
          next_billing_date: string | null
          plan_id: string
          pousada_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mp_preapproval_id?: string | null
          next_billing_date?: string | null
          plan_id: string
          pousada_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mp_preapproval_id?: string | null
          next_billing_date?: string | null
          plan_id?: string
          pousada_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subscriptions_pousada_id_fkey'
            columns: ['pousada_id']
            isOneToOne: true
            referencedRelation: 'pousadas'
            referencedColumns: ['id']
          },
        ]
      }
      traveler_profiles: {
        Row: {
          address_number: string | null
          complement: string | null
          district: string | null
          street: string | null
          accessibility_needs: string
          address: string | null
          birth_date: string | null
          cep: string | null
          city: string | null
          country: string
          created_at: string
          dietary_restrictions: string
          document_last4: string | null
          document_number: string | null
          document_number_hash: string | null
          document_type: string | null
          emergency_contact: Json
          nationality: string | null
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          address_number?: string | null
          complement?: string | null
          district?: string | null
          street?: string | null
          accessibility_needs?: string
          address?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          country?: string
          created_at?: string
          dietary_restrictions?: string
          document_last4?: string | null
          document_number?: string | null
          document_number_hash?: string | null
          document_type?: string | null
          emergency_contact?: Json
          nationality?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          address_number?: string | null
          complement?: string | null
          district?: string | null
          street?: string | null
          accessibility_needs?: string
          address?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          country?: string
          created_at?: string
          dietary_restrictions?: string
          document_last4?: string | null
          document_number?: string | null
          document_number_hash?: string | null
          document_type?: string | null
          emergency_contact?: Json
          nationality?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      used_oauth_states: {
        Row: {
          created_at: string
          nonce: string
        }
        Insert: {
          created_at?: string
          nonce: string
        }
        Update: {
          created_at?: string
          nonce?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_membership_invite: {
        Args: { p_membership_id: string }
        Returns: Json
      }
      apply_document_backfill: {
        Args: {
          p_document_last4: string
          p_document_number_encrypted: string
          p_document_number_hash: string
          p_guest_id: string
        }
        Returns: undefined
      }
      assert_can_manage_membership: {
        Args: { p_membership_id: string; p_pousada_id: string }
        Returns: {
          target_role: Database['public']['Enums']['user_role']
          target_status: Database['public']['Enums']['membership_status']
          target_user_id: string
        }[]
      }
      assert_login_not_locked: { Args: { p_email: string }; Returns: undefined }
      assert_room_available_for_booking: {
        Args: {
          p_adults: number
          p_checkin: string
          p_checkout: string
          p_children: number
          p_exclude_booking_id?: string
          p_pets: boolean
          p_pousada_id: string
          p_room_id: string
        }
        Returns: undefined
      }
      auth_can_manage_channels: {
        Args: { target_pousada: string }
        Returns: boolean
      }
      auth_can_manage_destinations: { Args: never; Returns: boolean }
      auth_can_manage_platform_finance: { Args: never; Returns: boolean }
      auth_can_manage_pousada: {
        Args: { target_pousada: string }
        Returns: boolean
      }
      auth_can_manage_pousadas_platform: { Args: never; Returns: boolean }
      auth_can_read_channels: {
        Args: { target_pousada: string }
        Returns: boolean
      }
      auth_can_review_booking: {
        Args: { p_booking_id: string; p_pousada_id: string }
        Returns: boolean
      }
      auth_has_active_grant: {
        Args: { target_pousada: string }
        Returns: boolean
      }
      auth_has_finance_access: {
        Args: { target_pousada: string }
        Returns: boolean
      }
      auth_has_guest_access: {
        Args: { target_pousada: string }
        Returns: boolean
      }
      auth_has_operational_access: {
        Args: { target_pousada: string }
        Returns: boolean
      }
      auth_has_room_read_access: {
        Args: { target_pousada: string }
        Returns: boolean
      }
      auth_is_active_owner_of: {
        Args: { target_pousada: string }
        Returns: boolean
      }
      auth_is_member_of: { Args: { target_pousada: string }; Returns: boolean }
      auth_is_platform_admin: { Args: never; Returns: boolean }
      auth_is_platform_master: { Args: never; Returns: boolean }
      cancel_room_block: {
        Args: {
          p_block_id: string
          p_cancellation_reason: string
          p_pousada_id: string
        }
        Returns: Json
      }
      catalog_search_text: { Args: { p_text: string }; Returns: string }
      consume_oauth_state_nonce: { Args: { p_nonce: string }; Returns: boolean }
      create_booking: {
        Args: {
          p_adults: number
          p_checkin: string
          p_checkout: string
          p_children: number
          p_code: string
          p_discount: number
          p_expected_arrival_time?: string
          p_expected_commission?: number
          p_external_channel_name?: string
          p_external_code?: string
          p_fee: number
          p_infants: number
          p_internal_notes?: string
          p_origin?: Database['public']['Enums']['booking_origin']
          p_payment_due_at?: string
          p_pets: boolean
          p_pousada_id: string
          p_responsible_guest_id: string
          p_room_id: string
          p_services_amount: number
          p_special_requests?: string
          p_status: Database['public']['Enums']['booking_status']
          p_subtotal: number
          p_surcharge: number
          p_total: number
          p_traveler_user_id?: string
        }
        Returns: Json
      }
      create_destination: {
        Args: {
          p_image: string
          p_name: string
          p_price_from: number
          p_rating: number
          p_season: string[]
          p_slug: string
          p_state: string
        }
        Returns: Json
      }
      create_pending_subscription: {
        Args: {
          p_mp_preapproval_id: string
          p_plan_id: string
          p_pousada_id: string
        }
        Returns: string
      }
      create_pousada: {
        Args: {
          p_city: string
          p_description: string
          p_name: string
          p_price: number
          p_slug: string
          p_state: string
        }
        Returns: string
      }
      create_quote_request: {
        Args: {
          p_adults?: number
          p_checkin?: string
          p_checkout?: string
          p_children?: number
          p_consent?: boolean
          p_email?: string
          p_message?: string
          p_name: string
          p_occasion?: string
          p_pets?: boolean
          p_phone: string
          p_pousada_id: string
        }
        Returns: Json
      }
      create_room_block: {
        Args: {
          p_block_type: Database['public']['Enums']['room_block_type']
          p_ends_at: string
          p_notes?: string
          p_pousada_id: string
          p_reason: string
          p_room_id: string
          p_source?: string
          p_starts_at: string
        }
        Returns: Json
      }
      decline_membership_invite: {
        Args: { p_membership_id: string }
        Returns: Json
      }
      delete_channel_calendar: {
        Args: { p_calendar_id: string }
        Returns: undefined
      }
      delete_destination: { Args: { p_id: string }; Returns: Json }
      ensure_traveler_guest: {
        Args: { p_email?: string; p_full_name: string; p_pousada_id: string }
        Returns: Json
      }
      expire_overdue_pending_bookings: { Args: never; Returns: Json }
      expire_pending_booking: { Args: { p_booking_id: string }; Returns: Json }
      get_booking_notification_context: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      get_channel_export_feed: { Args: { p_token: string }; Returns: Json }
      get_link_report: {
        Args: { p_days?: number; p_pousada_id: string }
        Returns: Json
      }
      get_pousada_payment_context: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      grant_platform_access: {
        Args: {
          p_expires_at: string
          p_granted_to: string
          p_pousada_id: string
          p_reason: string
        }
        Returns: string
      }
      invite_membership: {
        Args: {
          p_email: string
          p_pousada_id: string
          p_role: Database['public']['Enums']['user_role']
        }
        Returns: Json
      }
      link_pousada_owner: {
        Args: { p_email: string; p_pousada_id: string }
        Returns: Json
      }
      list_and_mark_checkin_reminders: {
        Args: { p_days_ahead?: number }
        Returns: Json
      }
      list_bookable_rooms: {
        Args: {
          p_checkin?: string
          p_checkout?: string
          p_guests?: number
          p_slug: string
        }
        Returns: {
          base_price: number
          capacity: number
          description: string
          id: string
          name: string
        }[]
      }
      list_channel_feeds_to_import: {
        Args: never
        Returns: {
          calendar_id: string
          import_url: string
        }[]
      }
      list_guests_pending_document_backfill: {
        Args: { p_limit?: number }
        Returns: {
          document_number: string
          id: string
        }[]
      }
      list_login_attempts: {
        Args: { p_email?: string; p_limit?: number }
        Returns: {
          created_at: string
          email: string
          id: string
          ip_masked: string
          success: boolean
        }[]
      }
      list_membership_emails: {
        Args: { p_pousada_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      list_membership_names: {
        Args: { p_pousada_id: string }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      list_platform_hosts: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          pousada_id: string
          pousada_name: string
          pousada_slug: string
          role: Database['public']['Enums']['user_role']
          user_id: string
        }[]
      }
      list_platform_team: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          platform_role: Database['public']['Enums']['platform_role']
          user_id: string
        }[]
      }
      list_public_rooms: {
        Args: { p_slug: string }
        Returns: {
          accessible: boolean
          amenity_names: string[]
          base_price: number
          bed_config: Json
          capacity: number
          capacity_max: number
          category_name: string
          description: string
          display_order: number
          id: string
          name: string
          pets_allowed: boolean
        }[]
      }
      list_rooms_for_housekeeping: {
        Args: { p_pousada_id: string }
        Returns: {
          capacity: number
          code: string
          id: string
          location: string
          name: string
          next_block_starts_at: string
          operational_note: string
          operational_status: Database['public']['Enums']['room_operational_status']
        }[]
      }
      pousada_local_date: {
        Args: { p_pousada_id: string }
        Returns: string
      }
      purge_stale_quote_requests: {
        Args: { p_retention_days?: number }
        Returns: Json
      }
      reactivate_member: {
        Args: { p_membership_id: string; p_pousada_id: string }
        Returns: Json
      }
      reconcile_marketplace_payment: {
        Args: {
          p_amount: number
          p_booking_id: string
          p_currency: string
          p_method: string
          p_provider_ref: string
          p_refunded_amount?: number
          p_status: Database['public']['Enums']['payment_status']
          p_updated_at: string
        }
        Returns: Json
      }
      record_link_event: {
        Args: {
          p_available_count?: number
          p_checkin?: string
          p_checkout?: string
          p_event: Database['public']['Enums']['link_event_type']
          p_guests?: number
          p_pousada_id: string
        }
        Returns: undefined
      }
      get_booking_pix_instructions: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      get_pousada_alert_emails: {
        Args: { p_booking_id: string }
        Returns: { email: string }[]
      }
      review_payment_proof: {
        Args: { p_proof_id: string; p_approve: boolean; p_reason?: string }
        Returns: Json
      }
      save_pousada_pix_settings: {
        Args: {
          p_pousada_id: string
          p_key_type: string
          p_pix_key: string
          p_holder_name: string
          p_city: string
          p_enabled: boolean
        }
        Returns: undefined
      }
      submit_payment_proof: {
        Args: {
          p_booking_id: string
          p_file_path: string
          p_file_name: string
          p_mime_type: string
          p_size_bytes: number
        }
        Returns: Json
      }
      claim_password_reset_slot: {
        Args: { p_email: string; p_ip: string }
        Returns: boolean
      }
      record_login_attempt: {
        Args: { p_email: string; p_ip: string; p_success: boolean }
        Returns: undefined
      }
      record_payment_and_confirm_booking: {
        Args: {
          p_amount: number
          p_booking_id: string
          p_method: string
          p_provider_ref: string
          p_raw?: Json
          p_status: Database['public']['Enums']['payment_status']
        }
        Returns: Json
      }
      record_subscription_invoice: {
        Args: {
          p_amount: number
          p_mp_payment_id: string
          p_mp_preapproval_id: string
          p_paid_at?: string
          p_period_end?: string
          p_period_start?: string
          p_status: string
        }
        Returns: Json
      }
      revoke_member: {
        Args: { p_membership_id: string; p_pousada_id: string }
        Returns: Json
      }
      revoke_platform_access: {
        Args: { p_grant_id: string }
        Returns: undefined
      }
      revoke_platform_role_by_email: {
        Args: { p_email: string }
        Returns: Json
      }
      save_channel_calendar: {
        Args: {
          p_export_token: string
          p_import_url: string
          p_label: string
          p_provider: Database['public']['Enums']['channel_provider']
          p_room_id: string
        }
        Returns: string
      }
      save_payment_account: {
        Args: {
          p_access_token: string
          p_expires_at: string
          p_live_mode: boolean
          p_mp_user_id: string
          p_pousada_id: string
          p_public_key: string
          p_refresh_token: string
        }
        Returns: Json
      }
      search_public_pousadas: {
        Args: {
          p_checkin?: string
          p_checkout?: string
          p_guests?: number
          p_page?: number
          p_page_size?: number
          p_search?: string
        }
        Returns: Json
      }
      set_booking_companions: {
        Args: { p_booking_id: string; p_companions: Json; p_version: number }
        Returns: Json
      }
      set_booking_status: {
        Args: {
          p_booking_id: string
          p_new_status: Database['public']['Enums']['booking_status']
          p_reason?: string
        }
        Returns: Json
      }
      set_plan_preapproval_id: {
        Args: { p_mp_preapproval_plan_id: string; p_plan_id: string }
        Returns: Json
      }
      set_platform_role_by_email: {
        Args: {
          p_email: string
          p_role: Database['public']['Enums']['platform_role']
        }
        Returns: Json
      }
      set_quote_request_status: {
        Args: {
          p_notes?: string
          p_request_id: string
          p_status: Database['public']['Enums']['quote_request_status']
        }
        Returns: undefined
      }
      suspend_member: {
        Args: {
          p_membership_id: string
          p_pousada_id: string
          p_reason: string
        }
        Returns: Json
      }
      sync_channel_events: {
        Args: {
          p_calendar_id: string
          p_error?: string
          p_events: Json
          p_status: Database['public']['Enums']['channel_sync_status']
        }
        Returns: Json
      }
      sync_subscription_status: {
        Args: {
          p_mp_preapproval_id: string
          p_next_billing_date?: string
          p_status: string
        }
        Returns: Json
      }
      update_booking: {
        Args: {
          p_adults: number
          p_booking_id: string
          p_checkin: string
          p_checkout: string
          p_children: number
          p_discount: number
          p_expected_arrival_time: string
          p_fee: number
          p_infants: number
          p_internal_notes: string
          p_origin: Database['public']['Enums']['booking_origin']
          p_pets: boolean
          p_responsible_guest_id: string
          p_room_id: string
          p_services_amount: number
          p_special_requests: string
          p_subtotal: number
          p_surcharge: number
          p_total: number
          p_version: number
        }
        Returns: Json
      }
      update_destination: {
        Args: {
          p_id: string
          p_image: string
          p_name: string
          p_price_from: number
          p_rating: number
          p_season: string[]
          p_slug: string
          p_state: string
        }
        Returns: Json
      }
      update_member_role: {
        Args: {
          p_membership_id: string
          p_pousada_id: string
          p_role: Database['public']['Enums']['user_role']
        }
        Returns: Json
      }
      update_room_operational_status: {
        Args: {
          p_pousada_id: string
          p_room_id: string
          p_status: Database['public']['Enums']['room_operational_status']
        }
        Returns: Json
      }
      upsert_guest: {
        Args: {
          p_accessibility_needs?: string
          p_address?: string
          p_birth_date?: string
          p_cep?: string
          p_city?: string
          p_country?: string
          p_dietary_restrictions?: string
          p_document_last4?: string
          p_document_number?: string
          p_document_number_hash?: string
          p_document_type?: string
          p_email?: string
          p_emergency_contact?: Json
          p_full_name?: string
          p_guest_id?: string
          p_internal_notes?: string
          p_marketing_consent?: boolean
          p_nationality?: string
          p_phone?: string
          p_pousada_id: string
          p_preferences?: string[]
          p_preferred_name?: string
          p_source?: Database['public']['Enums']['guest_source']
          p_state?: string
          p_user_id?: string
          p_whatsapp?: string
        }
        Returns: Json
      }
    }
    Enums: {
      payment_proof_status: 'submitted' | 'approved' | 'rejected'
      accommodation_status: 'active' | 'inactive'
      booking_guest_type: 'responsible' | 'adult' | 'child' | 'infant'
      booking_origin:
        | 'rota_das_pousadas'
        | 'site_proprio'
        | 'whatsapp'
        | 'telefone'
        | 'balcao'
        | 'booking_com'
        | 'airbnb'
        | 'expedia'
        | 'agencia'
        | 'outro'
        | 'link_bio'
      booking_status:
        'quote' | 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
      channel_provider: 'airbnb' | 'booking' | 'outro'
      channel_sync_status: 'never' | 'ok' | 'error'
      guest_source:
        'platform_account' | 'front_desk' | 'owner' | 'public_booking' | 'import' | 'other'
      link_event_type: 'view' | 'search' | 'quote_request' | 'booking_started'
      membership_status: 'invited' | 'active' | 'suspended' | 'revoked'
      payment_status: 'pendente' | 'aprovado' | 'recusado' | 'estornado'
      platform_role: 'suporte' | 'comercial' | 'marketing' | 'financeiro_plataforma' | 'master'
      pousada_status:
        | 'rascunho'
        | 'em_analise'
        | 'aprovada'
        | 'publicada'
        | 'suspensa'
        | 'arquivada'
        | 'reprovada'
      quote_request_status: 'novo' | 'respondido' | 'convertido' | 'descartado'
      room_block_status: 'active' | 'cancelled' | 'expired'
      room_block_type:
        | 'maintenance'
        | 'internal_use'
        | 'owner_reservation'
        | 'interdiction'
        | 'renovation'
        | 'operational_unavailability'
        | 'other'
      room_operational_status:
        | 'available'
        | 'occupied'
        | 'awaiting_cleaning'
        | 'cleaning'
        | 'inspection_pending'
        | 'maintenance'
        | 'blocked'
      tenant_status: 'onboarding' | 'active' | 'suspended' | 'inactive'
      user_role:
        'proprietario' | 'admin_pousada' | 'recepcionista' | 'financeiro_pousada' | 'governanca'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      accommodation_status: ['active', 'inactive'],
      booking_guest_type: ['responsible', 'adult', 'child', 'infant'],
      booking_origin: [
        'rota_das_pousadas',
        'site_proprio',
        'whatsapp',
        'telefone',
        'balcao',
        'booking_com',
        'airbnb',
        'expedia',
        'agencia',
        'outro',
        'link_bio',
      ],
      booking_status: [
        'quote',
        'pending',
        'confirmed',
        'checked_in',
        'checked_out',
        'cancelled',
        'no_show',
      ],
      channel_provider: ['airbnb', 'booking', 'outro'],
      channel_sync_status: ['never', 'ok', 'error'],
      guest_source: [
        'platform_account',
        'front_desk',
        'owner',
        'public_booking',
        'import',
        'other',
      ],
      link_event_type: ['view', 'search', 'quote_request', 'booking_started'],
      membership_status: ['invited', 'active', 'suspended', 'revoked'],
      payment_proof_status: ['submitted', 'approved', 'rejected'],
      payment_status: ['pendente', 'aprovado', 'recusado', 'estornado'],
      platform_role: ['suporte', 'comercial', 'marketing', 'financeiro_plataforma', 'master'],
      pousada_status: [
        'rascunho',
        'em_analise',
        'aprovada',
        'publicada',
        'suspensa',
        'arquivada',
        'reprovada',
      ],
      quote_request_status: ['novo', 'respondido', 'convertido', 'descartado'],
      room_block_status: ['active', 'cancelled', 'expired'],
      room_block_type: [
        'maintenance',
        'internal_use',
        'owner_reservation',
        'interdiction',
        'renovation',
        'operational_unavailability',
        'other',
      ],
      room_operational_status: [
        'available',
        'occupied',
        'awaiting_cleaning',
        'cleaning',
        'inspection_pending',
        'maintenance',
        'blocked',
      ],
      tenant_status: ['onboarding', 'active', 'suspended', 'inactive'],
      user_role: [
        'proprietario',
        'admin_pousada',
        'recepcionista',
        'financeiro_pousada',
        'governanca',
      ],
    },
  },
} as const
