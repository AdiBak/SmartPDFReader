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

export interface DatabaseUser {
  id: string;
  username: string;
  created_at: string;
}

export interface DatabasePDF {
  id: string;
  user_id: string;
  name: string;
  file_url: string;
  upload_date: string;
  processed: boolean;
  file_size: number;
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
      // Get or create user
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingUser) {
        this.currentUserId = existingUser.id;
        return existingUser.id;
      }

      // Create new user if doesn't exist
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({ username })
        .select('id')
        .single();

      if (createError) throw createError;

      this.currentUserId = newUser.id;
      return newUser.id;
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

  async saveChat(pdfId: string, messages: ChatMessage[]): Promise<void> {
    if (!this.currentUserId) throw new Error('User not initialized');

    try {
      // Check if chat already exists
      const { data: existingChat } = await supabase
        .from('chats')
        .select('id')
        .eq('user_id', this.currentUserId)
        .eq('pdf_id', pdfId)
        .single();

      if (existingChat) {
        // Update existing chat
        const { error } = await supabase
          .from('chats')
          .update({ 
            messages: messages,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingChat.id);

        if (error) throw error;
      } else {
        // Create new chat
        const { error } = await supabase
          .from('chats')
          .insert({
            user_id: this.currentUserId,
            pdf_id: pdfId,
            messages: messages
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving chat:', error);
      throw error;
    }
  }

  async getChat(pdfId: string): Promise<ChatMessage[]> {
    if (!this.currentUserId) throw new Error('User not initialized');

    try {
      const { data, error } = await supabase
        .from('chats')
        .select('messages')
        .eq('user_id', this.currentUserId)
        .eq('pdf_id', pdfId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      return data?.messages || [];
    } catch (error) {
      console.error('Error getting chat:', error);
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
