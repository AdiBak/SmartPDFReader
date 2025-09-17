import { ExtractedPDF } from './textExtractor';

export interface TextChunk {
  id: string;
  text: string;
  pageNumber: number;
  chunkIndex: number;
  pdfId: string;
  pdfName: string;
  metadata: {
    startChar: number;
    endChar: number;
    wordCount: number;
    section?: string;
  };
}

export class TextChunker {
  private static readonly MAX_CHUNK_SIZE = 1000; // characters
  private static readonly OVERLAP_SIZE = 200; // characters
  private static readonly MIN_CHUNK_SIZE = 100; // characters

  /**
   * Chunk text from an extracted PDF
   */
  static chunkPDF(extractedPDF: ExtractedPDF): TextChunk[] {
    const chunks: TextChunk[] = [];
    
    extractedPDF.extractedText.forEach((pageText, pageIndex) => {
      const pageChunks = this.chunkText(
        pageText.text,
        pageText.pageNumber,
        extractedPDF.id,
        extractedPDF.name,
        pageIndex
      );
      chunks.push(...pageChunks);
    });
    
    return chunks;
  }

  /**
   * Chunk a single text string
   */
  private static chunkText(
    text: string,
    pageNumber: number,
    pdfId: string,
    pdfName: string,
    _pageIndex: number
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    const sentences = this.splitIntoSentences(text);
    
    let currentChunk = '';
    let chunkIndex = 0;
    let startChar = 0;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      // If adding this sentence would exceed max size, finalize current chunk
      if (potentialChunk.length > this.MAX_CHUNK_SIZE && currentChunk.length > this.MIN_CHUNK_SIZE) {
        chunks.push(this.createChunk(
          currentChunk,
          pageNumber,
          chunkIndex,
          pdfId,
          pdfName,
          startChar,
          startChar + currentChunk.length
        ));
        
        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk);
        currentChunk = overlapText + (overlapText ? ' ' : '') + sentence;
        startChar += currentChunk.length - overlapText.length - sentence.length;
        chunkIndex++;
      } else {
        currentChunk = potentialChunk;
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.trim().length > 0) {
      chunks.push(this.createChunk(
        currentChunk,
        pageNumber,
        chunkIndex,
        pdfId,
        pdfName,
        startChar,
        startChar + currentChunk.length
      ));
    }
    
    return chunks;
  }

  /**
   * Split text into sentences
   */
  private static splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - can be enhanced with more sophisticated NLP
    return text
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private static getOverlapText(chunk: string): string {
    if (chunk.length <= this.OVERLAP_SIZE) {
      return chunk;
    }
    
    // Find the last complete sentence within the overlap size
    const overlapText = chunk.slice(-this.OVERLAP_SIZE);
    const lastSentenceEnd = overlapText.lastIndexOf('.');
    
    if (lastSentenceEnd > 0) {
      return overlapText.slice(lastSentenceEnd + 1).trim();
    }
    
    return overlapText;
  }

  /**
   * Create a text chunk object
   */
  private static createChunk(
    text: string,
    pageNumber: number,
    chunkIndex: number,
    pdfId: string,
    pdfName: string,
    startChar: number,
    endChar: number
  ): TextChunk {
    return {
      id: `${pdfId}-page${pageNumber}-chunk${chunkIndex}`,
      text: text.trim(),
      pageNumber,
      chunkIndex,
      pdfId,
      pdfName,
      metadata: {
        startChar,
        endChar,
        wordCount: text.split(/\s+/).length,
        section: this.detectSection(text),
      },
    };
  }

  /**
   * Detect section headers in text (simple heuristic)
   */
  private static detectSection(text: string): string | undefined {
    const lines = text.split('\n');
    const firstLine = lines[0]?.trim();
    
    // Simple heuristics for section detection
    if (firstLine && (
      firstLine.match(/^[A-Z][A-Z\s]+$/) || // All caps
      firstLine.match(/^\d+\.\s/) || // Numbered sections
      firstLine.match(/^[IVX]+\.\s/) || // Roman numerals
      firstLine.length < 50 && firstLine.endsWith(':') // Short lines ending with colon
    )) {
      return firstLine;
    }
    
    return undefined;
  }

  /**
   * Chunk multiple PDFs
   */
  static chunkMultiplePDFs(extractedPDFs: ExtractedPDF[]): TextChunk[] {
    const allChunks: TextChunk[] = [];
    
    extractedPDFs.forEach(extractedPDF => {
      const chunks = this.chunkPDF(extractedPDF);
      allChunks.push(...chunks);
    });
    
    return allChunks;
  }

  /**
   * Get chunks for specific PDFs
   */
  static getChunksForPDFs(chunks: TextChunk[], pdfIds: string[]): TextChunk[] {
    return chunks.filter(chunk => pdfIds.includes(chunk.pdfId));
  }
}
