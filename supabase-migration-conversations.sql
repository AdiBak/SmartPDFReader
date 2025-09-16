-- Migration script to add conversations table
-- Run this in your Supabase SQL editor

-- Create conversations table (replaces the old chats table)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pdf_ids JSONB NOT NULL DEFAULT '[]', -- Array of PDF IDs
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at);

-- Optional: Drop the old chats table if it exists (uncomment if you want to remove it)
-- DROP TABLE IF EXISTS public.chats;
