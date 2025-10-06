// Type definitions for the Smart PDF Reader

export interface PDFDocument {
  id: string;
  name: string;
  url: string;
  pages: number;
  uploadedAt: Date;
}

export interface PDFPage {
  pageNumber: number;
  content: string;
  annotations: Annotation[];
}

export interface Annotation {
  id: string;
  type: 'highlight' | 'note' | 'bookmark';
  content: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pageNumber: number;
  createdAt: Date;
  // Highlight-specific properties
  color?: string;
  comment?: string;
  pdfId?: string;
  // Store full highlight areas for multi-line highlights
  highlightAreas?: Array<{
    pageIndex: number;
    left: number;
    top: number;
    width: number;
    height: number;
  }>;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[]; // References to PDF pages/sections
}

export interface RAGResponse {
  answer: string;
  sources: {
    pageNumber: number;
    content: string;
    confidence: number;
  }[];
  metadata: {
    processingTime: number;
    totalDocuments: number;
  };
}
