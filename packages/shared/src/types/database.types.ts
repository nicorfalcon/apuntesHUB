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
      course_enrollments: {
        Row: {
          amount: number
          course_id: string
          id: string
          mp_preference_id: string | null
          payment_id: string | null
          platform_fee: number
          purchased_at: string
          seller_amount: number
          status: string
          student_id: string
        }
        Insert: {
          amount: number
          course_id: string
          id?: string
          mp_preference_id?: string | null
          payment_id?: string | null
          platform_fee?: number
          purchased_at?: string
          seller_amount?: number
          status?: string
          student_id: string
        }
        Update: {
          amount?: number
          course_id?: string
          id?: string
          mp_preference_id?: string | null
          payment_id?: string | null
          platform_fee?: number
          purchased_at?: string
          seller_amount?: number
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "recorded_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          duration_seconds: number
          id: string
          position: number
          title: string
          updated_at: string
          video_duration_verified_at: string | null
          video_storage_key: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          duration_seconds?: number
          id?: string
          position: number
          title: string
          updated_at?: string
          video_duration_verified_at?: string | null
          video_storage_key?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number
          id?: string
          position?: number
          title?: string
          updated_at?: string
          video_duration_verified_at?: string | null
          video_storage_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "recorded_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_progress: {
        Row: {
          completed_at: string | null
          enrollment_id: string
          id: string
          module_id: string
          updated_at: string
          watched_seconds: number
        }
        Insert: {
          completed_at?: string | null
          enrollment_id: string
          id?: string
          module_id: string
          updated_at?: string
          watched_seconds?: number
        }
        Update: {
          completed_at?: string | null
          enrollment_id?: string
          id?: string
          module_id?: string
          updated_at?: string
          watched_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_reviews: {
        Row: {
          comment: string | null
          course_id: string
          created_at: string
          enrollment_id: string
          id: string
          rating: number
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          course_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          rating: number
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          course_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          rating?: number
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "recorded_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_reviews_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          resume_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          resume_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          resume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      folder_items: {
        Row: {
          added_at: string | null
          folder_id: string
          id: string
          resume_id: string
        }
        Insert: {
          added_at?: string | null
          folder_id: string
          id?: string
          resume_id: string
        }
        Update: {
          added_at?: string | null
          folder_id?: string
          id?: string
          resume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folder_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folder_items_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      login_intents: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          ip_hash: string | null
          pending_session_ciphertext: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id: string
          ip_hash?: string | null
          pending_session_ciphertext: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_hash?: string | null
          pending_session_ciphertext?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          career: string | null
          created_at: string
          display_name: string
          id: string
          is_tutor: boolean
          role: string
          seller_rating_avg: number | null
          seller_rating_count: number | null
          tutor_bio: string | null
          tutor_rating_avg: number
          tutor_rating_count: number
          tutor_verified_at: string | null
          university: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          career?: string | null
          created_at?: string
          display_name?: string
          id: string
          is_tutor?: boolean
          role?: string
          seller_rating_avg?: number | null
          seller_rating_count?: number | null
          tutor_bio?: string | null
          tutor_rating_avg?: number
          tutor_rating_count?: number
          tutor_verified_at?: string | null
          university?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          career?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_tutor?: boolean
          role?: string
          seller_rating_avg?: number | null
          seller_rating_count?: number | null
          tutor_bio?: string | null
          tutor_rating_avg?: number
          tutor_rating_count?: number
          tutor_verified_at?: string | null
          university?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          id: string
          mp_preference_id: string | null
          payment_id: string | null
          platform_fee: number
          resume_id: string
          seller_amount: number
          seller_id: string
          status: string
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          id?: string
          mp_preference_id?: string | null
          payment_id?: string | null
          platform_fee?: number
          resume_id: string
          seller_amount?: number
          seller_id: string
          status?: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          id?: string
          mp_preference_id?: string | null
          payment_id?: string | null
          platform_fee?: number
          resume_id?: string
          seller_amount?: number
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recorded_courses: {
        Row: {
          author_id: string
          course_type: string
          cover_color: string | null
          cover_image_url: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_published: boolean
          price_ars: number
          published_at: string | null
          rating_avg: number
          rating_count: number
          subject_id: string
          title: string
          total_duration_seconds: number
          updated_at: string
        }
        Insert: {
          author_id: string
          course_type: string
          cover_color?: string | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          price_ars: number
          published_at?: string | null
          rating_avg?: number
          rating_count?: number
          subject_id: string
          title: string
          total_duration_seconds?: number
          updated_at?: string
        }
        Update: {
          author_id?: string
          course_type?: string
          cover_color?: string | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          price_ars?: number
          published_at?: string | null
          rating_avg?: number
          rating_count?: number
          subject_id?: string
          title?: string
          total_duration_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recorded_courses_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recorded_courses_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          career: string
          created_at: string
          deleted_at: string | null
          description: string | null
          file_url: string | null
          id: string
          preview_url: string | null
          price: number
          rating_avg: number
          rating_count: number
          seller_id: string
          status: string
          subject: string
          title: string
          university: string
          updated_at: string
        }
        Insert: {
          career: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          preview_url?: string | null
          price: number
          rating_avg?: number
          rating_count?: number
          seller_id: string
          status?: string
          subject: string
          title: string
          university: string
          updated_at?: string
        }
        Update: {
          career?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          preview_url?: string | null
          price?: number
          rating_avg?: number
          rating_count?: number
          seller_id?: string
          status?: string
          subject?: string
          title?: string
          university?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          purchase_id: string
          rating: number
          resume_id: string
          reviewer_id: string
          seller_id: string
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          purchase_id: string
          rating: number
          resume_id: string
          reviewer_id: string
          seller_id: string
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          purchase_id?: string
          rating?: number
          resume_id?: string
          reviewer_id?: string
          seller_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_mp_credentials: {
        Row: {
          connected_at: string
          id: string
          mp_access_token: string
          mp_public_key: string
          mp_refresh_token: string
          mp_token_expires_at: string
          mp_user_id: string
          updated_at: string
        }
        Insert: {
          connected_at?: string
          id: string
          mp_access_token: string
          mp_public_key: string
          mp_refresh_token: string
          mp_token_expires_at: string
          mp_user_id: string
          updated_at?: string
        }
        Update: {
          connected_at?: string
          id?: string
          mp_access_token?: string
          mp_public_key?: string
          mp_refresh_token?: string
          mp_token_expires_at?: string
          mp_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_mp_credentials_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          career: string | null
          created_at: string
          id: string
          name: string
          university: string
        }
        Insert: {
          career?: string | null
          created_at?: string
          id?: string
          name: string
          university: string
        }
        Update: {
          career?: string | null
          created_at?: string
          id?: string
          name?: string
          university?: string
        }
        Relationships: []
      }
      tutor_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          modality: string
          start_time: string
          tutor_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          modality: string
          start_time: string
          tutor_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          modality?: string
          start_time?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_availability_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_bookings: {
        Row: {
          created_at: string
          duration_minutes: number
          hourly_rate_ars: number | null
          id: string
          initial_message: string | null
          scheduled_at: string | null
          status: string
          student_id: string
          subject_id: string | null
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          hourly_rate_ars?: number | null
          id?: string
          initial_message?: string | null
          scheduled_at?: string | null
          status?: string
          student_id: string
          subject_id?: string | null
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          hourly_rate_ars?: number | null
          id?: string
          initial_message?: string | null
          scheduled_at?: string | null
          status?: string
          student_id?: string
          subject_id?: string | null
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_bookings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_bookings_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_messages: {
        Row: {
          body: string
          booking_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          booking_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          booking_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "tutor_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewer_id: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewer_id: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewer_id?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "tutor_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_reviews_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_subjects: {
        Row: {
          approval_proof_url: string | null
          approved_at: string | null
          created_at: string
          hourly_rate_ars: number
          id: string
          is_active: boolean
          subject_id: string
          tutor_id: string
        }
        Insert: {
          approval_proof_url?: string | null
          approved_at?: string | null
          created_at?: string
          hourly_rate_ars: number
          id?: string
          is_active?: boolean
          subject_id: string
          tutor_id: string
        }
        Update: {
          approval_proof_url?: string | null
          approved_at?: string | null
          created_at?: string
          hourly_rate_ars?: number
          id?: string
          is_active?: boolean
          subject_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_subjects_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string
          device_id: string
          id: string
          ip_hash: string | null
          label: string | null
          last_seen_at: string
          session_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          ip_hash?: string | null
          label?: string | null
          last_seen_at?: string
          session_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          ip_hash?: string | null
          label?: string | null
          last_seen_at?: string
          session_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_purchase: {
        Args: { p_payment_id: string; p_purchase_id: string }
        Returns: undefined
      }
      consume_login_intent_and_revoke_device: {
        Args: {
          p_device_row_id: string
          p_intent_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      fail_purchase: {
        Args: { p_payment_id: string; p_purchase_id: string }
        Returns: undefined
      }
      get_resume_download_url: { Args: { p_resume_id: string }; Returns: Json }
      purchase_resume: { Args: { p_resume_id: string }; Returns: Json }
      revoke_all_my_sessions: { Args: never; Returns: undefined }
      revoke_my_session: { Args: { p_session_id: string }; Returns: undefined }
      search_chunks: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          resume_id: string
          similarity: number
        }[]
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

// ============================================
// Tipos derivados para uso en componentes
// ============================================
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Resume = Database["public"]["Tables"]["resumes"]["Row"]
export type Purchase = Database["public"]["Tables"]["purchases"]["Row"]
export type Review = Database["public"]["Tables"]["reviews"]["Row"]

export type ResumeWithSeller = Resume & {
  profiles: Pick<
    Profile,
    "display_name" | "avatar_url" | "seller_rating_avg" | "seller_rating_count"
  >
}

export type PurchaseWithResume = Purchase & {
  // Supabase devuelve null en joins cuando el registro relacionado no existe o RLS lo filtra
  resumes:
    | (Pick<Resume, "title" | "subject" | "university" | "preview_url"> & {
        profiles: Pick<Profile, "display_name"> | null
      })
    | null
  // Supabase retorna objeto (no array) por el UNIQUE constraint en purchase_id
  reviews: { id: string } | null
}

export type SellerMpCredentials = Database["public"]["Tables"]["seller_mp_credentials"]["Row"]
export type UserDevice = Database["public"]["Tables"]["user_devices"]["Row"]
export type Folder = Database["public"]["Tables"]["folders"]["Row"]
export type FolderItem = Database["public"]["Tables"]["folder_items"]["Row"]
export type FolderWithItems = Folder & {
  folder_items: (FolderItem & {
    resumes: Pick<Resume, "title" | "subject" | "university" | "preview_url"> | null
  })[]
}

// ============================================
// Tipos derivados Etapa 1 — tutoría y cursos grabados
// ============================================
export type Subject = Database["public"]["Tables"]["subjects"]["Row"]
export type TutorSubject = Database["public"]["Tables"]["tutor_subjects"]["Row"]
export type TutorAvailability = Database["public"]["Tables"]["tutor_availability"]["Row"]
export type TutorBooking = Database["public"]["Tables"]["tutor_bookings"]["Row"]
export type TutorMessage = Database["public"]["Tables"]["tutor_messages"]["Row"]
export type TutorReview = Database["public"]["Tables"]["tutor_reviews"]["Row"]

export type RecordedCourse = Database["public"]["Tables"]["recorded_courses"]["Row"]
export type CourseModule = Database["public"]["Tables"]["course_modules"]["Row"]
export type CourseEnrollment = Database["public"]["Tables"]["course_enrollments"]["Row"]
export type CourseProgress = Database["public"]["Tables"]["course_progress"]["Row"]
export type CourseReview = Database["public"]["Tables"]["course_reviews"]["Row"]
