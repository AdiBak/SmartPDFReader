import { TextExtractor, ExtractedPDF } from './textExtractor';
import { TextChunker } from './textChunker';
import { EmbeddingService } from './embeddingService';
import { VectorStore, SearchResult } from './vectorStore';
import { PDFDocument } from '../components/PDFManager';

export interface RAGConfig {
  openaiApiKey: string;
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
      apiKey: config.openaiApiKey,
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
      this.config.openaiApiKey
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
      
      // Check if the question contains multiple questions
      const questions = this.detectMultipleQuestions(question);
      
      if (questions.length > 1) {
        console.log(`Detected ${questions.length} separate questions, processing each individually`);
        return await this.processMultipleQuestions(questions, pdfIds, startTime);
      }
      
      // Single question processing (original logic)
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
   * Detect multiple questions in a single message
   */
  private detectMultipleQuestions(text: string): string[] {
    // Common question patterns
    const questionPatterns = [
      /\?/g, // Question marks
      /^(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does|did)\b/gi, // Question words
    ];
    
    // Split by common separators that might indicate multiple questions
    const separators = [
      /\n\s*\n/, // Double newlines
      /\.\s+(?=[A-Z])/, // Period followed by capital letter
      /\?\s+(?=[A-Z])/, // Question mark followed by capital letter
      /\?\s*\n/, // Question mark followed by newline
    ];
    
    let questions: string[] = [text.trim()];
    
    // Try splitting by separators
    for (const separator of separators) {
      const split = questions.flatMap(q => q.split(separator));
      if (split.length > questions.length) {
        questions = split.map(q => q.trim()).filter(q => q.length > 0);
        break;
      }
    }
    
    // If we still have only one question, try to detect multiple questions by question marks
    if (questions.length === 1) {
      const questionMarks = (text.match(/\?/g) || []).length;
      if (questionMarks > 1) {
        // Split by question marks and reconstruct
        const parts = text.split(/\?/);
        questions = [];
        for (let i = 0; i < parts.length - 1; i++) {
          const question = (parts[i] + '?').trim();
          if (question.length > 10) { // Only include substantial questions
            questions.push(question);
          }
        }
      }
    }
    
    return questions.filter(q => q.length > 5); // Filter out very short fragments
  }

  /**
   * Process multiple questions separately
   */
  private async processMultipleQuestions(
    questions: string[],
    pdfIds: string[],
    startTime: number
  ): Promise<RAGResponse> {
    const answers: string[] = [];
    const allSources: Array<{
      pdfName: string;
      pageNumber: number;
      text: string;
      similarity: number;
    }> = [];
    let totalChunksUsed = 0;

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      console.log(`Processing question ${i + 1}/${questions.length}: "${question}"`);
      
      try {
        // Search for relevant chunks for this specific question
        const searchResults = await this.vectorStore.search(
          question,
          pdfIds,
          Math.ceil(this.config.maxChunks / questions.length) // Distribute chunks across questions
        );
        
        if (searchResults.length > 0) {
          // Generate response for this question
          const answer = await this.generateResponse(question, searchResults);
          answers.push(`**Question ${i + 1}:** ${question}\n\n**Answer:** ${answer}`);
          
          // Collect sources
          searchResults.forEach(result => {
            allSources.push({
              pdfName: result.chunk.pdfName,
              pageNumber: result.chunk.pageNumber,
              text: result.chunk.text,
              similarity: result.similarity,
            });
          });
          
          totalChunksUsed += searchResults.length;
        } else {
          answers.push(`**Question ${i + 1}:** ${question}\n\n**Answer:** I couldn't find relevant information in the selected PDFs to answer this question.`);
        }
      } catch (error) {
        console.error(`Error processing question ${i + 1}:`, error);
        answers.push(`**Question ${i + 1}:** ${question}\n\n**Answer:** Sorry, I encountered an error while processing this question.`);
      }
    }

    return {
      answer: answers.join('\n\n---\n\n'),
      sources: allSources,
      metadata: {
        processingTime: Date.now() - startTime,
        chunksUsed: totalChunksUsed,
        pdfsQueried: pdfIds,
      },
    };
  }

  /**
   * Generate response using OpenAI
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
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
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
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
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
