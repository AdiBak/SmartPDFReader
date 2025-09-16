import { createClient } from '@supabase/supabase-js';

// These will be set via environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'your-supabase-url';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          created_at?: string;
        };
      };
      pdfs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          file_url: string;
          upload_date: string;
          processed: boolean;
          file_size: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          file_url: string;
          upload_date?: string;
          processed?: boolean;
          file_size: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          file_url?: string;
          upload_date?: string;
          processed?: boolean;
          file_size?: number;
        };
      };
      chats: {
        Row: {
          id: string;
          user_id: string;
          pdf_id: string;
          messages: any; // JSON array of messages
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pdf_id: string;
          messages: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          pdf_id?: string;
          messages?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      highlights: {
        Row: {
          id: string;
          user_id: string;
          pdf_id: string;
          content: string;
          position: any; // JSON object with x, y, width, height
          page_number: number;
          color: string;
          comment?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pdf_id: string;
          content: string;
          position: any;
          page_number: number;
          color: string;
          comment?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          pdf_id?: string;
          content?: string;
          position?: any;
          page_number?: number;
          color?: string;
          comment?: string;
          created_at?: string;
        };
      };
    };
  };
}
