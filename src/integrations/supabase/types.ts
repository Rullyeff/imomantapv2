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
      adherence_logs: {
        Row: {
          created_at: string | null
          id: string
          is_late: boolean | null
          is_taken: boolean | null
          medication_id: string
          notes: string | null
          reported_by: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: string | null
          taken_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_late?: boolean | null
          is_taken?: boolean | null
          medication_id: string
          notes?: string | null
          reported_by?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string | null
          taken_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_late?: boolean | null
          is_taken?: boolean | null
          medication_id?: string
          notes?: string | null
          reported_by?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string | null
          taken_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adherence_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string | null
          confirmed_by: string | null
          created_at: string | null
          doctor_name: string | null
          hospital_name: string | null
          id: string
          is_attended: boolean | null
          is_confirmed: boolean | null
          notes: string | null
          reminder_days: number[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          appointment_date: string
          appointment_time?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          doctor_name?: string | null
          hospital_name?: string | null
          id?: string
          is_attended?: boolean | null
          is_confirmed?: boolean | null
          notes?: string | null
          reminder_days?: number[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          doctor_name?: string | null
          hospital_name?: string | null
          id?: string
          is_attended?: boolean | null
          is_confirmed?: boolean | null
          notes?: string | null
          reminder_days?: number[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      consultation_messages: {
        Row: {
          consultation_id: string
          created_at: string
          id: string
          message: string
          sender_id: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          id?: string
          message: string
          sender_id: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_messages_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_requests: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          patient_id: string
          pharmacist_id: string | null
          priority: string | null
          responded_at: string | null
          responded_by: string | null
          response: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          patient_id: string
          pharmacist_id?: string | null
          priority?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          patient_id?: string
          pharmacist_id?: string | null
          priority?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      educational_content: {
        Row: {
          author: string | null
          content: string
          created_at: string | null
          disease_type: string | null
          id: string
          is_published: boolean | null
          published_by: string | null
          read_time: number | null
          tags: string[] | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author?: string | null
          content: string
          created_at?: string | null
          disease_type?: string | null
          id?: string
          is_published?: boolean | null
          published_by?: string | null
          read_time?: number | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author?: string | null
          content?: string
          created_at?: string | null
          disease_type?: string | null
          id?: string
          is_published?: boolean | null
          published_by?: string | null
          read_time?: number | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      health_screenings: {
        Row: {
          age: number | null
          asam_urat: number | null
          created_at: string
          diastolik: number | null
          full_name: string
          gender: string
          gula_darah: number | null
          id: string
          kolesterol: number | null
          notes: string | null
          respondent_code: string
          sistolik: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          age?: number | null
          asam_urat?: number | null
          created_at?: string
          diastolik?: number | null
          full_name: string
          gender: string
          gula_darah?: number | null
          id?: string
          kolesterol?: number | null
          notes?: string | null
          respondent_code: string
          sistolik?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          age?: number | null
          asam_urat?: number | null
          created_at?: string
          diastolik?: number | null
          full_name?: string
          gender?: string
          gula_darah?: number | null
          id?: string
          kolesterol?: number | null
          notes?: string | null
          respondent_code?: string
          sistolik?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      measurements: {
        Row: {
          asam_urat: number | null
          created_at: string | null
          diastolik: number | null
          disease_type: Database["public"]["Enums"]["disease_type"]
          gula_pp: number | null
          gula_puasa: number | null
          id: string
          is_abnormal: boolean | null
          meal_description: string | null
          measurement_time: string | null
          notes: string | null
          reviewed_by: string | null
          sistolik: number | null
          stress_level: number | null
          user_id: string
          water_intake: number | null
        }
        Insert: {
          asam_urat?: number | null
          created_at?: string | null
          diastolik?: number | null
          disease_type: Database["public"]["Enums"]["disease_type"]
          gula_pp?: number | null
          gula_puasa?: number | null
          id?: string
          is_abnormal?: boolean | null
          meal_description?: string | null
          measurement_time?: string | null
          notes?: string | null
          reviewed_by?: string | null
          sistolik?: number | null
          stress_level?: number | null
          user_id: string
          water_intake?: number | null
        }
        Update: {
          asam_urat?: number | null
          created_at?: string | null
          diastolik?: number | null
          disease_type?: Database["public"]["Enums"]["disease_type"]
          gula_pp?: number | null
          gula_puasa?: number | null
          id?: string
          is_abnormal?: boolean | null
          meal_description?: string | null
          measurement_time?: string | null
          notes?: string | null
          reviewed_by?: string | null
          sistolik?: number | null
          stress_level?: number | null
          user_id?: string
          water_intake?: number | null
        }
        Relationships: []
      }
      medication_catalog: {
        Row: {
          created_at: string
          created_by: string | null
          disease_type: Database["public"]["Enums"]["disease_type"]
          dosage: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          disease_type: Database["public"]["Enums"]["disease_type"]
          dosage?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          disease_type?: Database["public"]["Enums"]["disease_type"]
          dosage?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      medications: {
        Row: {
          approved_by: string | null
          created_at: string | null
          disease_type: Database["public"]["Enums"]["disease_type"]
          dosage: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          is_approved: boolean | null
          name: string
          prescribed_by: string | null
          quantity: number | null
          refill_reminder: number | null
          schedule_time: string[]
          unit: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string | null
          disease_type: Database["public"]["Enums"]["disease_type"]
          dosage?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_approved?: boolean | null
          name: string
          prescribed_by?: string | null
          quantity?: number | null
          refill_reminder?: number | null
          schedule_time?: string[]
          unit?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string | null
          disease_type?: Database["public"]["Enums"]["disease_type"]
          dosage?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_approved?: boolean | null
          name?: string
          prescribed_by?: string | null
          quantity?: number | null
          refill_reminder?: number | null
          schedule_time?: string[]
          unit?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          sent_at: string | null
          sent_via: string[] | null
          title: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          sent_at?: string | null
          sent_via?: string[] | null
          title?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          sent_at?: string | null
          sent_via?: string[] | null
          title?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      patient_logbook: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          recommendation: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          recommendation?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          recommendation?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          age: number | null
          created_at: string | null
          emergency_contact: string | null
          full_name: string | null
          gender: string | null
          height: number | null
          id: string
          is_verified: boolean | null
          phone_number: string | null
          target_asam_urat: number | null
          target_diastolik: number | null
          target_gula_pp: number | null
          target_gula_puasa: number | null
          target_sistolik: number | null
          updated_at: string | null
          user_id: string
          verified_by: string | null
          weight: number | null
        }
        Insert: {
          address?: string | null
          age?: number | null
          created_at?: string | null
          emergency_contact?: string | null
          full_name?: string | null
          gender?: string | null
          height?: number | null
          id?: string
          is_verified?: boolean | null
          phone_number?: string | null
          target_asam_urat?: number | null
          target_diastolik?: number | null
          target_gula_pp?: number | null
          target_gula_puasa?: number | null
          target_sistolik?: number | null
          updated_at?: string | null
          user_id: string
          verified_by?: string | null
          weight?: number | null
        }
        Update: {
          address?: string | null
          age?: number | null
          created_at?: string | null
          emergency_contact?: string | null
          full_name?: string | null
          gender?: string | null
          height?: number | null
          id?: string
          is_verified?: boolean | null
          phone_number?: string | null
          target_asam_urat?: number | null
          target_diastolik?: number | null
          target_gula_pp?: number | null
          target_gula_puasa?: number | null
          target_sistolik?: number | null
          updated_at?: string | null
          user_id?: string
          verified_by?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_audit_logs: {
        Row: {
          action: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_adherence_daily: {
        Args: { _days: number; _user_id: string }
        Returns: {
          day: string
          pct: number
          taken: number
          total: number
        }[]
      }
      get_adherence_summary: {
        Args: { _days: number; _user_id: string }
        Returns: {
          late: number
          missed: number
          on_time: number
          pct: number
          taken: number
          total: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "pasien" | "apoteker" | "admin"
      disease_type: "hipertensi" | "asam_urat" | "gula_darah"
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
    Enums: {
      app_role: ["pasien", "apoteker", "admin"],
      disease_type: ["hipertensi", "asam_urat", "gula_darah"],
    },
  },
} as const
