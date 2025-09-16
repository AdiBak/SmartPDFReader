import { TextExtractor, ExtractedPDF } from './textExtractor';
import { TextChunker } from './textChunker';
import { EmbeddingService } from './embeddingService';
import { VectorStore, SearchResult } from './vectorStore';
import { PDFDocument } from '../components/PDFManager';

export interface RAGConfig {
  mistralApiKey: string;
  maxChunks: number;
  temperature: number;
}

export interface RAGResponse {
  answer: string;
  sources: Array<{
    pdfName: string;
    pageNumber: number;
    text: string;
    similarity: number;
  }>;
  metadata: {
    processingTime: number;
    chunksUsed: number;
    pdfsQueried: string[];
  };
}

export class RAGService {
  private vectorStore: VectorStore;
  private config: RAGConfig;
  private extractedPDFs: Map<string, ExtractedPDF> = new Map();

  constructor(config: RAGConfig) {
    this.config = config;
    this.vectorStore = new VectorStore({
      apiKey: config.mistralApiKey,
    });
  }

  /**
   * Process a PDF file and add it to the RAG system
   */
  async processPDF(pdfDocument: PDFDocument): Promise<void> {
    try {
      console.log(`Processing PDF: ${pdfDocument.name}`);
      
      // Extract text from PDF
      const extractedPDF = await TextExtractor.extractTextFromPDF(
        pdfDocument.file, 
        pdfDocument.id, 
        pdfDocument.name
      );
      this.extractedPDFs.set(pdfDocument.id, extractedPDF);
      
      // Chunk the text
      const chunks = TextChunker.chunkPDF(extractedPDF);
      console.log(`Created ${chunks.length} chunks for ${pdfDocument.name}`);
      
      // Generate embeddings
      const embeddedChunks = await EmbeddingService.generateEmbeddings(
        chunks,
        this.config.mistralApiKey
      );
      console.log(`Generated embeddings for ${embeddedChunks.length} chunks`);
      
      // Add to vector store
      this.vectorStore.addChunks(embeddedChunks);
      
      console.log(`Successfully processed PDF: ${pdfDocument.name}`);
    } catch (error) {
      console.error(`Error processing PDF ${pdfDocument.name}:`, error);
      throw new Error(`Failed to process PDF: ${error}`);
    }
  }

  /**
   * Process multiple PDFs
   */
  async processMultiplePDFs(pdfDocuments: PDFDocument[]): Promise<void> {
    const results = await Promise.allSettled(
      pdfDocuments.map(pdf => this.processPDF(pdf))
    );
    
    const failures = results
      .map((result, index) => ({ result, pdf: pdfDocuments[index] }))
      .filter(({ result }) => result.status === 'rejected');
    
    if (failures.length > 0) {
      console.warn(`Failed to process ${failures.length} PDFs:`, failures);
    }
  }

  /**
   * Query the RAG system
   */
  async query(
    question: string,
    pdfIds: string[]
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`Querying RAG system: "${question}" for PDFs: ${pdfIds.join(', ')}`);
      
      // Search for relevant chunks
      const searchResults = await this.vectorStore.search(
        question,
        pdfIds,
        this.config.maxChunks
      );
      
      console.log(`Search results for question "${question}":`, searchResults.length);
      console.log('Vector store stats:', this.vectorStore.getStats());
      
      if (searchResults.length === 0) {
        const stats = this.vectorStore.getStats();
        const processedPDFs = Object.keys(stats.chunksPerPDF);
        const requestedPDFs = pdfIds;
        
        console.log('No search results found. Debug info:');
        console.log('- Requested PDFs:', requestedPDFs);
        console.log('- Processed PDFs:', processedPDFs);
        console.log('- Total chunks in store:', stats.totalChunks);
        
        return {
          answer: `I couldn't find relevant information in the selected PDFs to answer your question. 

Debug info:
- Requested PDFs: ${requestedPDFs.join(', ')}
- Processed PDFs: ${processedPDFs.join(', ')}
- Total chunks available: ${stats.totalChunks}

Please make sure the PDFs are uploaded and processed first.`,
          sources: [],
          metadata: {
            processingTime: Date.now() - startTime,
            chunksUsed: 0,
            pdfsQueried: pdfIds,
          },
        };
      }
      
      // Generate response using OpenAI
      const answer = await this.generateResponse(question, searchResults);
      
      // Format sources
      const sources = searchResults.map(result => ({
        pdfName: result.chunk.pdfName,
        pageNumber: result.chunk.pageNumber,
        text: result.chunk.text,
        similarity: result.similarity,
      }));
      
      return {
        answer,
        sources,
        metadata: {
          processingTime: Date.now() - startTime,
          chunksUsed: searchResults.length,
          pdfsQueried: pdfIds,
        },
      };
    } catch (error) {
      console.error('Error querying RAG system:', error);
      throw new Error(`Failed to query RAG system: ${error}`);
    }
  }

  /**
   * Generate response using Mistral
   */
  private async generateResponse(
    question: string,
    searchResults: SearchResult[]
  ): Promise<string> {
    const context = searchResults
      .map((result, index) => {
        const chunk = result.chunk;
        return `[Source ${index + 1} from ${chunk.pdfName}, Page ${chunk.pageNumber}]
${chunk.text}`;
      })
      .join('\n\n');

    const prompt = `You are a helpful assistant that answers questions based on the provided context from PDF documents. Use only the information provided in the context to answer the question. If the context doesn't contain enough information to answer the question, say so.

Context:
${context}

Question: ${question}

Answer:`;

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.mistralApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: this.config.temperature,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Mistral API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error(`Failed to generate response: ${error}`);
    }
  }

  /**
   * Remove a PDF from the RAG system
   */
  removePDF(pdfId: string): void {
    this.vectorStore.removePDF(pdfId);
    this.extractedPDFs.delete(pdfId);
  }

  /**
   * Get statistics about the RAG system
   */
  getStats(): {
    totalPDFs: number;
    totalChunks: number;
    pdfs: Array<{
      id: string;
      name: string;
      chunks: number;
    }>;
  } {
    const vectorStats = this.vectorStore.getStats();
    const pdfs = Array.from(this.extractedPDFs.values()).map(pdf => ({
      id: pdf.id,
      name: pdf.name,
      chunks: vectorStats.chunksPerPDF[pdf.id] || 0,
    }));

    return {
      totalPDFs: vectorStats.totalPDFs,
      totalChunks: vectorStats.totalChunks,
      pdfs,
    };
  }

  /**
   * Check if a PDF is processed
   */
  isPDFProcessed(pdfId: string): boolean {
    return this.extractedPDFs.has(pdfId);
  }

  /**
   * Get processed PDFs
   */
  getProcessedPDFs(): ExtractedPDF[] {
    return Array.from(this.extractedPDFs.values());
  }
}
