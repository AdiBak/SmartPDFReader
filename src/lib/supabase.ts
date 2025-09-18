import { createClient } from '@supabase/supabase-js';

// These will be set via environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'your-supabase-url';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types - Updated to match current schema
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          password_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          password_hash: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          password_hash?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      pdfs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          size: number;
          url: string;
          upload_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          size: number;
          url: string;
          upload_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          size?: number;
          url?: string;
          upload_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          pdf_ids: string[];
          messages: any; // JSON array of messages
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          pdf_ids?: string[];
          messages?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          pdf_ids?: string[];
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
          text: string;
          color: string;
          comment?: string;
          page_number: number;
          position: any; // JSON object with position data
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pdf_id: string;
          text: string;
          color?: string;
          comment?: string;
          page_number: number;
          position: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          pdf_id?: string;
          text?: string;
          color?: string;
          comment?: string;
          page_number?: number;
          position?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
