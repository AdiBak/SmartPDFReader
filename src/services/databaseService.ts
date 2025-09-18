import { supabase } from '../lib/supabase';
import { PDFDocument } from '../components/PDFManager';
import { Annotation } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{
    pdfName: string;
    pageNumber: number;
    text: string;
    similarity: number;
  }>;
}

export interface Conversation {
  id: string;
  name: string;
  pdfIds: string[];
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseUser {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface DatabasePDF {
  id: string;
  user_id: string;
  name: string;
  size: number;
  url: string;
  upload_date: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseChat {
  id: string;
  user_id: string;
  pdf_id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface DatabaseHighlight {
  id: string;
  user_id: string;
  pdf_id: string;
  content: string;
  position: any;
  page_number: number;
  color: string;
  comment?: string;
  created_at: string;
}

export class DatabaseService {
  private currentUserId: string | null = null;

  async initializeUser(username: string): Promise<string> {
    try {
      console.log('Initializing user:', username);
      console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Supabase Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      // Test connection first
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (testError) {
        console.error('Supabase connection test failed:', testError);
        throw new Error(`Database connection failed: ${testError.message}`);
      }
      
      console.log('Supabase connection test successful');

      // Get existing user (admin user is created by setup script)
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', username);

      if (fetchError) {
        console.error('Error fetching user:', fetchError);
        throw fetchError;
      }

      console.log('Query result:', existingUser);

      if (existingUser && existingUser.length > 0) {
        console.log('User found:', existingUser[0].id);
        this.currentUserId = existingUser[0].id;
        return existingUser[0].id;
      }

      // If user doesn't exist, let's check what users are actually in the database
      const { data: allUsers, error: allUsersError } = await supabase
        .from('users')
        .select('id, username');
      
      console.log('All users in database:', allUsers);
      
      // If user doesn't exist, throw an error (shouldn't happen with setup script)
      throw new Error(`User '${username}' not found. Available users: ${allUsers?.map(u => u.username).join(', ') || 'none'}. Please run the setup script.`);
    } catch (error) {
      console.error('Error initializing user:', error);
      throw error;
    }
  }

  async savePDF(pdf: PDFDocument): Promise<string> {
    if (!this.currentUserId) throw new Error('User not initialized');

    try {
      // Generate a proper UUID for the PDF
      const pdfUuid = uuidv4();
      
      // Upload file to Supabase Storage
      const fileExt = pdf.file.name.split('.').pop();
      const fileName = `${this.currentUserId}/${pdfUuid}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(fileName, pdf.file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('pdfs')
        .getPublicUrl(fileName);

      // Save PDF metadata to database
      const { data, error } = await supabase
        .from('pdfs')
        .insert({
          id: pdfUuid,
          user_id: this.currentUserId,
          name: pdf.name,
          file_url: publicUrl,
          file_size: pdf.file.size,
          processed: false
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error saving PDF:', error);
      throw error;
    }
  }

  async getPDFs(): Promise<PDFDocument[]> {
    if (!this.currentUserId) throw new Error('User not initialized');

    try {
      const { data, error } = await supabase
        .from('pdfs')
        .select('*')
        .eq('user_id', this.currentUserId)
        .order('upload_date', { ascending: false });

      if (error) throw error;

      // Convert database PDFs to our PDFDocument format
      const pdfs: PDFDocument[] = [];
      for (const dbPdf of data) {
        // Download file from storage using the stored file path
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('pdfs')
          .download(`${this.currentUserId}/${dbPdf.id}.pdf`);

        if (downloadError) {
          console.error('Error downloading PDF:', downloadError);
          continue;
        }

        const file = new File([fileData], `${dbPdf.name}.pdf`, { type: 'application/pdf' });
        const dataUrl = await this.fileToDataUrl(file);

        pdfs.push({
          id: dbPdf.id,
          name: dbPdf.name,
          file,
          dataUrl,
          uploadDate: new Date(dbPdf.upload_date)
        });
      }

      return pdfs;
    } catch (error) {
      console.error('Error getting PDFs:', error);
      throw error;
    }
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    if (!this.currentUserId) throw new Error('User not initialized');

    try {
      // Check if conversation already exists
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', this.currentUserId)
        .eq('id', conversation.id)
        .single();

      if (existingConversation) {
        // Update existing conversation
        const { error } = await supabase
          .from('conversations')
          .update({ 
            name: conversation.name,
            pdf_ids: conversation.pdfIds,
            messages: conversation.messages,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation.id);

        if (error) throw error;
      } else {
        // Create new conversation
        const { error } = await supabase
          .from('conversations')
          .insert({
            id: conversation.id,
            user_id: this.currentUserId,
            name: conversation.name,
            pdf_ids: conversation.pdfIds,
            messages: conversation.messages
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving conversation:', error);
      throw error;
    }
  }

  async getConversations(): Promise<Conversation[]> {
    if (!this.currentUserId) throw new Error('User not initialized');

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', this.currentUserId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return data.map(conv => ({
        id: conv.id,
        name: conv.name,
        pdfIds: conv.pdf_ids,
        messages: conv.messages || [],
        createdAt: new Date(conv.created_at),
        updatedAt: new Date(conv.updated_at)
      }));
    } catch (error) {
      console.error('Error getting conversations:', error);
      throw error;
    }
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    if (!this.currentUserId) throw new Error('User not initialized');

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', this.currentUserId)
        .eq('id', conversationId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) return null;

      return {
        id: data.id,
        name: data.name,
        pdfIds: data.pdf_ids,
        messages: data.messages || [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      console.error('Error getting conversation:', error);
      throw error;
    }
  }

  async saveHighlight(highlight: Annotation, pdfId: string): Promise<string> {
    if (!this.currentUserId) throw new Error('User not initialized');

    try {
      // Generate a proper UUID for the highlight
      const highlightUuid = uuidv4();
      
      const { error } = await supabase
        .from('highlights')
        .insert({
          id: highlightUuid,
          user_id: this.currentUserId,
          pdf_id: pdfId,
          content: highlight.content,
          position: highlight.position,
          page_number: highlight.pageNumber,
          color: highlight.color || '#ffeb3b',
          comment: highlight.comment
        });

      if (error) throw error;
      return highlightUuid;
    } catch (error) {
      console.error('Error saving highlight:', error);
      throw error;
    }
  }

  async getHighlights(pdfId: string): Promise<Annotation[]> {
    if (!this.currentUserId) throw new Error('User not initialized');

    try {
      const { data, error } = await supabase
        .from('highlights')
        .select('*')
        .eq('user_id', this.currentUserId)
        .eq('pdf_id', pdfId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(h => ({
        id: h.id,
        type: 'highlight' as const,
        content: h.content,
        position: h.position,
        pageNumber: h.page_number,
        color: h.color,
        comment: h.comment,
        pdfId: h.pdf_id, // Add the pdfId field
        createdAt: new Date(h.created_at)
      }));
    } catch (error) {
      console.error('Error getting highlights:', error);
      throw error;
    }
  }

  async updateHighlight(highlightId: string, updates: Partial<Annotation>): Promise<void> {
    if (!this.currentUserId) throw new Error('User not initialized');

    try {
      const updateData: any = {};
      if (updates.comment !== undefined) updateData.comment = updates.comment;
      if (updates.color !== undefined) updateData.color = updates.color;

      const { error } = await supabase
        .from('highlights')
        .update(updateData)
        .eq('id', highlightId)
        .eq('user_id', this.currentUserId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating highlight:', error);
      throw error;
    }
  }

  async deleteHighlight(highlightId: string): Promise<void> {
    if (!this.currentUserId) throw new Error('User not initialized');

    try {
      const { error } = await supabase
        .from('highlights')
        .delete()
        .eq('id', highlightId)
        .eq('user_id', this.currentUserId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting highlight:', error);
      throw error;
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    if (!this.currentUserId) throw new Error('User not initialized');

    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', this.currentUserId); // Ensure user can only delete their own conversations

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  async deletePDF(pdfId: string): Promise<void> {
    if (!this.currentUserId) throw new Error('User not initialized');

    try {
      // First, get the PDF to find the file path for storage deletion
      const { data: pdf, error: fetchError } = await supabase
        .from('pdfs')
        .select('file_url')
        .eq('id', pdfId)
        .eq('user_id', this.currentUserId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from storage
      if (pdf?.file_url) {
        const filePath = pdf.file_url.split('/').slice(-2).join('/'); // Extract user_id/filename
        const { error: storageError } = await supabase.storage
          .from('pdfs')
          .remove([filePath]);

        if (storageError) {
          console.warn('Error deleting file from storage:', storageError);
          // Continue with database deletion even if storage deletion fails
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('pdfs')
        .delete()
        .eq('id', pdfId)
        .eq('user_id', this.currentUserId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting PDF:', error);
      throw error;
    }
  }

  private async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  logout(): void {
    this.currentUserId = null;
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
