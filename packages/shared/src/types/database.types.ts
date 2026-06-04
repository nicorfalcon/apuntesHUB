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
      course_video_assets: {
        Row: {
          activated_at: string | null
          created_at: string
          duration_seconds: number | null
          encryption_key_id: string
          error_message: string | null
          hls_key_storage_key: string | null
          hls_playlist_storage_key: string | null
          hls_segment_prefix: string | null
          id: string
          is_active: boolean
          module_id: string
          original_video_storage_key: string | null
          processing_completed_at: string | null
          processing_progress: number | null
          processing_stage: string | null
          processing_started_at: string | null
          processing_status: "pending" | "processing" | "ready" | "failed"
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          encryption_key_id?: string
          error_message?: string | null
          hls_key_storage_key?: string | null
          hls_playlist_storage_key?: string | null
          hls_segment_prefix?: string | null
          id?: string
          is_active?: boolean
          module_id: string
          original_video_storage_key?: string | null
          processing_completed_at?: string | null
          processing_progress?: number | null
          processing_stage?: string | null
          processing_started_at?: string | null
          processing_status?: "pending" | "processing" | "ready" | "failed"
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          encryption_key_id?: string
          error_message?: string | null
          hls_key_storage_key?: string | null
          hls_playlist_storage_key?: string | null
          hls_segment_prefix?: string | null
          id?: string
          is_active?: boolean
          module_id?: string
          original_video_storage_key?: string | null
          processing_completed_at?: string | null
          processing_progress?: number | null
          processing_stage?: string | null
          processing_started_at?: string | null
          processing_status?: "pending" | "processing" | "ready" | "failed"
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_video_assets_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
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
      ingestion_jobs: {
        Row: {
          id: string
          resume_id: string
          status: "pending" | "processing" | "done" | "failed"
          chunks_generated: number
          error_message: string | null
          started_at: string | null
          finished_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          resume_id: string
          status?: "pending" | "processing" | "done" | "failed"
          chunks_generated?: number
          error_message?: string | null
          started_at?: string | null
          finished_at?: string | null
          created_at?: string
        }
        Update: {
          status?: "pending" | "processing" | "done" | "failed"
          chunks_generated?: number
          error_message?: string | null
          started_at?: string | null
          finished_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: true
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
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
      material_answer_helpful_votes: {
        Row: {
          answer_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_answer_helpful_votes_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "material_question_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_answer_helpful_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_question_answers: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_official: boolean
          question_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_official?: boolean
          question_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_official?: boolean
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_question_answers_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "material_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      material_question_followups: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          question_id: string
          role: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          question_id: string
          role: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          question_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_question_followups_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_question_followups_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "material_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      material_question_me_toos: {
        Row: {
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_question_me_toos_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "material_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_question_me_toos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_questions: {
        Row: {
          anchor_page: number | null
          anchor_seconds: number | null
          author_id: string
          body: string
          course_id: string | null
          created_at: string
          id: string
          is_anonymous_to_buyers: boolean
          module_id: string | null
          resume_id: string | null
          status: string
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          anchor_page?: number | null
          anchor_seconds?: number | null
          author_id: string
          body: string
          course_id?: string | null
          created_at?: string
          id?: string
          is_anonymous_to_buyers?: boolean
          module_id?: string | null
          resume_id?: string | null
          status?: string
          target_type: string
          title: string
          updated_at?: string
        }
        Update: {
          anchor_page?: number | null
          anchor_seconds?: number | null
          author_id?: string
          body?: string
          course_id?: string | null
          created_at?: string
          id?: string
          is_anonymous_to_buyers?: boolean
          module_id?: string | null
          resume_id?: string | null
          status?: string
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_questions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "recorded_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_questions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_questions_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
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
      tutor_blocked_slots: {
        Row: {
          block_type: string
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
          tutor_id: string
        }
        Insert: {
          block_type?: string
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
          tutor_id: string
        }
        Update: {
          block_type?: string
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_blocked_slots_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_bookings: {
        Row: {
          amount: number | null
          confirmed_at: string | null
          created_at: string
          duration_minutes: number
          hourly_rate_ars: number | null
          id: string
          initial_message: string | null
          modality: string
          mp_preference_id: string | null
          payment_expires_at: string | null
          payment_id: string | null
          platform_fee: number
          scheduled_at: string | null
          seller_amount: number
          status: string
          student_id: string
          subject_id: string | null
          tutor_id: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          confirmed_at?: string | null
          created_at?: string
          duration_minutes?: number
          hourly_rate_ars?: number | null
          id?: string
          initial_message?: string | null
          modality?: string
          mp_preference_id?: string | null
          payment_expires_at?: string | null
          payment_id?: string | null
          platform_fee?: number
          scheduled_at?: string | null
          seller_amount?: number
          status?: string
          student_id: string
          subject_id?: string | null
          tutor_id: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          confirmed_at?: string | null
          created_at?: string
          duration_minutes?: number
          hourly_rate_ars?: number | null
          id?: string
          initial_message?: string | null
          modality?: string
          mp_preference_id?: string | null
          payment_expires_at?: string | null
          payment_id?: string | null
          platform_fee?: number
          scheduled_at?: string | null
          seller_amount?: number
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
      can_answer_material_question: {
        Args: { p_question_id: string; p_user_id: string }
        Returns: boolean
      }
      can_answer_material_target: {
        Args: {
          p_course_id: string | null
          p_resume_id: string | null
          p_target_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      can_ask_material_question: {
        Args: {
          p_course_id: string | null
          p_resume_id: string | null
          p_target_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      can_react_to_material_answer: {
        Args: { p_answer_id: string; p_user_id: string }
        Returns: boolean
      }
      can_react_to_material_question: {
        Args: { p_question_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_material_answer: {
        Args: { p_question_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_material_question: {
        Args: {
          p_author_id: string
          p_course_id: string | null
          p_resume_id: string | null
          p_status: string
          p_target_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      can_view_recorded_course: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: boolean
      }
      complete_course_enrollment: {
        Args: { p_enrollment_id: string; p_payment_id: string }
        Returns: undefined
      }
      complete_purchase: {
        Args: { p_payment_id: string; p_purchase_id: string }
        Returns: undefined
      }
      complete_tutoring_booking: {
        Args: {
          p_booking_id: string
          p_payment_id: string
        }
        Returns: boolean
      }
      consume_login_intent_and_revoke_device: {
        Args: {
          p_device_row_id: string
          p_intent_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      create_tutoring_booking: {
        Args: {
          p_duration_minutes: number
          p_initial_message?: string
          p_modality: string
          p_scheduled_at: string
          p_subject_id: string
          p_tutor_id: string
        }
        Returns: Json
      }
      enroll_course: { Args: { p_course_id: string }; Returns: Json }
      expire_pending_tutoring_bookings: {
        Args: { p_tutor_id?: string }
        Returns: number
      }
      fail_course_enrollment: {
        Args: { p_enrollment_id: string; p_payment_id: string }
        Returns: undefined
      }
      fail_purchase: {
        Args: { p_payment_id: string; p_purchase_id: string }
        Returns: undefined
      }
      fail_tutoring_booking: {
        Args: { p_booking_id: string; p_payment_id: string }
        Returns: undefined
      }
      get_resume_download_url: { Args: { p_resume_id: string }; Returns: Json }
      has_completed_course_enrollment: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: boolean
      }
      has_completed_resume_purchase: {
        Args: { p_resume_id: string; p_user_id: string }
        Returns: boolean
      }
      is_recorded_course_author: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: boolean
      }
      is_resume_seller: {
        Args: { p_resume_id: string; p_user_id: string }
        Returns: boolean
      }
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
      search_chunks_browse: {
        Args: {
          query_embedding: string
          match_count?: number
          min_similarity?: number
        }
        Returns: {
          resume_id: string
          similarity: number
        }[]
      }
      search_chunks_for_study: {
        Args: {
          query_embedding: string
          match_count?: number
          min_similarity?: number
          resume_ids?: string[] | null
        }
        Returns: {
          resume_id: string
          chunk_index: number
          content: string
          similarity: number
        }[]
      }
      search_chunks_hybrid_for_study: {
        Args: {
          query_text: string
          query_embedding: string
          resume_ids?: string[] | null
          match_count?: number
          min_vector_similarity?: number
          vector_weight?: number
          chunk_text_weight?: number
        }
        Returns: {
          resume_id: string
          chunk_index: number
          content: string
          score: number
          vector_score: number
          chunk_text_score: number
        }[]
      }
      search_resumes_hybrid_browse: {
        Args: {
          query_text: string
          query_embedding: string
          match_count?: number
          vector_weight?: number
          chunk_text_weight?: number
          metadata_weight?: number
          min_vector_similarity?: number
        }
        Returns: {
          resume_id: string
          score: number
          vector_score: number
          chunk_text_score: number
          metadata_score: number
          best_chunk_index: number | null
          match_reason: string
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
  resumes:
    | (Pick<Resume, "title" | "subject" | "university" | "preview_url"> & {
        profiles: Pick<Profile, "display_name"> | null
      })
    | null
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
// Tipos derivados — tutoría y cursos grabados
// ============================================
export type Subject = Database["public"]["Tables"]["subjects"]["Row"]
export type TutorSubject = Database["public"]["Tables"]["tutor_subjects"]["Row"]
export type TutorAvailability = Database["public"]["Tables"]["tutor_availability"]["Row"]
export type TutorBlockedSlot = Database["public"]["Tables"]["tutor_blocked_slots"]["Row"]
export type TutorBooking = Database["public"]["Tables"]["tutor_bookings"]["Row"]
export type TutorMessage = Database["public"]["Tables"]["tutor_messages"]["Row"]
export type TutorReview = Database["public"]["Tables"]["tutor_reviews"]["Row"]

export type RecordedCourse = Database["public"]["Tables"]["recorded_courses"]["Row"]
export type CourseModule = Database["public"]["Tables"]["course_modules"]["Row"]
export type CourseEnrollment = Database["public"]["Tables"]["course_enrollments"]["Row"]
export type CourseProgress = Database["public"]["Tables"]["course_progress"]["Row"]
export type CourseReview = Database["public"]["Tables"]["course_reviews"]["Row"]
export type CourseVideoAsset = Database["public"]["Tables"]["course_video_assets"]["Row"]

// ============================================
// Tipos derivados — consultas privadas por material
// ============================================
export type MaterialQuestion = Database["public"]["Tables"]["material_questions"]["Row"]
export type MaterialQuestionAnswer =
  Database["public"]["Tables"]["material_question_answers"]["Row"]
export type MaterialQuestionMeToo =
  Database["public"]["Tables"]["material_question_me_toos"]["Row"]
export type MaterialAnswerHelpfulVote =
  Database["public"]["Tables"]["material_answer_helpful_votes"]["Row"]
