# LawBandit Smart Reader - Setup Guide

This guide will walk you through setting up the LawBandit Smart Reader application from scratch.

## Prerequisites

Before you begin, ensure you have the following:

- **Node.js 18+** and npm installed
- **Supabase account** (free tier available at [supabase.com](https://supabase.com))
- **OpenAI API key** (get one at [platform.openai.com](https://platform.openai.com))

## Step 1: Clone and Install

```bash
git clone https://github.com/AdiBak/LawBanditAssessment.git
cd LawBanditAssessment
npm install
```

## Step 2: Supabase Setup

### 2.1 Create a New Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `lawbandit-smart-reader` (or your preferred name)
   - **Database Password**: Generate a strong password and save it
   - **Region**: Choose the region closest to you
5. Click "Create new project"
6. Wait for the project to be created (usually 2-3 minutes)

### 2.2 Set Up Database Schema

1. In your Supabase dashboard, go to the **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `supabase-setup.sql` from this repository
4. Paste it into the SQL editor
5. Click "Run" to execute the script

**Note**: This script will drop all existing tables and recreate them with the correct structure. This ensures a clean, consistent setup.

This script will:
- Create all necessary database tables (users, pdfs, conversations, highlights)
- Set up proper indexes for performance
- Create storage bucket for PDF files
- Set up Row Level Security (RLS) policies
- Insert the default user account
- Configure storage policies

### 2.3 Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://your-project-id.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

## Step 3: Environment Configuration

### 3.1 Create Environment File

```bash
cp .env.example .env.local
```

### 3.2 Add Your API Keys

Open `.env.local` and add your credentials:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# OpenAI Configuration
VITE_OPENAI_API_KEY=your-openai-api-key-here
```

**Important**: Replace the placeholder values with your actual credentials.

## Step 4: Storage Configuration

### 4.1 Configure Storage Bucket

1. In your Supabase dashboard, go to **Storage**
2. You should see a bucket named `pdfs` (created by the setup script)
3. If not, create it manually:
   - Click "New bucket"
   - Name: `pdfs`
   - Make it **Private** (not public)

### 4.2 Verify Storage Policies

The setup script should have created the necessary storage policies, but you can verify them in **Storage** → **Policies**:

- Users can upload their own PDFs
- Users can view their own PDFs  
- Users can delete their own PDFs

## Step 5: Run the Application

```bash
npm run dev
```

The application will start on [http://localhost:3000](http://localhost:3000)

## Step 6: Test the Setup

1. Open [http://localhost:3000](http://localhost:3000) in your browser
2. Login with the default credentials:
   - **Username**: `admin123`
   - **Password**: `password123`
3. Try uploading a PDF and creating a chat to verify everything works

## Troubleshooting

### Common Issues

**"Invalid API key" error:**
- Double-check your Supabase URL and anon key in `.env.local`
- Ensure there are no extra spaces or quotes around the values

**"Failed to upload PDF" error:**
- Verify the `pdfs` storage bucket exists in Supabase
- Check that storage policies are properly configured
- Ensure your Supabase project is not paused

**"OpenAI API error":**
- Verify your OpenAI API key is correct
- Check that you have sufficient credits in your OpenAI account
- Ensure the API key has the necessary permissions

**Database connection issues:**
- Verify the database setup script ran successfully
- Check that all tables were created in the Supabase dashboard
- Ensure RLS policies are enabled

### Getting Help

If you encounter issues:

1. Check the browser console for error messages
2. Verify all environment variables are set correctly
3. Ensure your Supabase project is active and not paused
4. Check the Supabase logs in the dashboard for any errors

## Production Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Add the same environment variables in Vercel's dashboard
4. Deploy!

### Environment Variables for Production

Make sure to set these in your Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` 
- `VITE_OPENAI_API_KEY`

## Security Notes

- The default user account is for demonstration purposes only
- In production, implement proper user registration and authentication
- Consider implementing rate limiting for API calls
- Regularly rotate your API keys
- Monitor your Supabase usage to avoid unexpected charges

## Support

If you need help with the setup process, please:
1. Check this guide thoroughly
2. Review the main README.md for technical details
3. Check the Supabase and OpenAI documentation
4. Open an issue in the GitHub repository

---

**Note**: This setup guide assumes you're using the free tiers of Supabase and OpenAI. For production use, consider upgrading to paid plans for better performance and higher limits.
