export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          university: string | null;
          career: string | null;
          role: "buyer" | "seller" | "both";
          seller_rating_avg: number | null;
          seller_rating_count: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          university?: string | null;
          career?: string | null;
          role?: "buyer" | "seller" | "both";
          seller_rating_avg?: number | null;
          seller_rating_count?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          university?: string | null;
          career?: string | null;
          role?: "buyer" | "seller" | "both";
          seller_rating_avg?: number | null;
          seller_rating_count?: number | null;
          updated_at?: string;
        };
      };
      resumes: {
        Row: {
          id: string;
          seller_id: string;
          title: string;
          description: string | null;
          subject: string;
          university: string;
          career: string;
          price: number;
          file_url: string | null;
          preview_url: string | null;
          status: "draft" | "published" | "archived";
          rating_avg: number;
          rating_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          title: string;
          description?: string | null;
          subject: string;
          university: string;
          career: string;
          price: number;
          file_url?: string | null;
          preview_url?: string | null;
          status?: "draft" | "published" | "archived";
          rating_avg?: number;
          rating_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          seller_id?: string;
          title?: string;
          description?: string | null;
          subject?: string;
          university?: string;
          career?: string;
          price?: number;
          file_url?: string | null;
          preview_url?: string | null;
          status?: "draft" | "published" | "archived";
          rating_avg?: number;
          rating_count?: number;
          updated_at?: string;
        };
      };
      purchases: {
        Row: {
          id: string;
          buyer_id: string;
          resume_id: string;
          seller_id: string;
          amount: number;
          platform_fee: number;
          seller_amount: number;
          status: "pending" | "completed" | "refunded" | "failed";
          payment_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          resume_id: string;
          seller_id: string;
          amount: number;
          platform_fee?: number;
          seller_amount?: number;
          status?: "pending" | "completed" | "refunded" | "failed";
          payment_id?: string | null;
          created_at?: string;
        };
        Update: {
          status?: "pending" | "completed" | "refunded" | "failed";
          payment_id?: string | null;
        };
      };
      reviews: {
        Row: {
          id: string;
          purchase_id: string;
          reviewer_id: string;
          seller_id: string;
          resume_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          purchase_id: string;
          reviewer_id: string;
          seller_id: string;
          resume_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          rating?: number;
          comment?: string | null;
        };
      };
      folders: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
          updated_at?: string;
        };
      };
      folder_items: {
        Row: {
          id: string;
          folder_id: string;
          resume_id: string;
          added_at: string;
        };
        Insert: {
          id?: string;
          folder_id: string;
          resume_id: string;
          added_at?: string;
        };
        Update: never;
      };
    };
    Functions: {
      purchase_resume: {
        Args: { p_resume_id: string };
        Returns: { purchase_id: string; status: string };
      };
      get_resume_download_url: {
        Args: { p_resume_id: string };
        Returns: { file_url: string; resume_id: string };
      };
    };
  };
}

// Tipos derivados para uso en componentes
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Resume = Database["public"]["Tables"]["resumes"]["Row"];
export type Purchase = Database["public"]["Tables"]["purchases"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];

export type ResumeWithSeller = Resume & {
  profiles: Pick<
    Profile,
    "display_name" | "avatar_url" | "seller_rating_avg" | "seller_rating_count"
  >;
};

export type PurchaseWithResume = Purchase & {
  // Supabase devuelve null en joins cuando el registro relacionado no existe o RLS lo filtra
  resumes: (Pick<Resume, "title" | "subject" | "university" | "preview_url"> & {
    profiles: Pick<Profile, "display_name"> | null;
  }) | null;
  // Supabase retorna objeto (no array) por el UNIQUE constraint en purchase_id
  reviews: { id: string } | null;
};

export type Folder = Database["public"]["Tables"]["folders"]["Row"];
export type FolderItem = Database["public"]["Tables"]["folder_items"]["Row"];
export type FolderWithItems = Folder & {
  folder_items: (FolderItem & {
    resumes: Pick<Resume, "title" | "subject" | "university" | "preview_url"> | null;
  })[];
};
