import { EmbeddedChunk } from './embeddingService';
import { TextChunk } from './textChunker';

export interface VectorStoreConfig {
  apiKey: string;
  indexName?: string;
}

export interface SearchResult {
  chunk: EmbeddedChunk;
  similarity: number;
  score: number;
}

export class VectorStore {
  private embeddedChunks: Map<string, EmbeddedChunk> = new Map();
  private pdfChunks: Map<string, string[]> = new Map(); // pdfId -> chunkIds
  private config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = config;
  }

  /**
   * Add embedded chunks to the vector store
   */
  addChunks(embeddedChunks: EmbeddedChunk[]): void {
    embeddedChunks.forEach(chunk => {
      this.embeddedChunks.set(chunk.id, chunk);
      
      // Track chunks by PDF
      if (!this.pdfChunks.has(chunk.pdfId)) {
        this.pdfChunks.set(chunk.pdfId, []);
      }
      this.pdfChunks.get(chunk.pdfId)!.push(chunk.id);
    });
  }

  /**
   * Remove all chunks for a specific PDF
   */
  removePDF(pdfId: string): void {
    const chunkIds = this.pdfChunks.get(pdfId) || [];
    chunkIds.forEach(chunkId => {
      this.embeddedChunks.delete(chunkId);
    });
    this.pdfChunks.delete(pdfId);
  }

  /**
   * Get all chunks for specific PDFs
   */
  getChunksForPDFs(pdfIds: string[]): EmbeddedChunk[] {
    const chunks: EmbeddedChunk[] = [];
    
    pdfIds.forEach(pdfId => {
      const chunkIds = this.pdfChunks.get(pdfId) || [];
      chunkIds.forEach(chunkId => {
        const chunk = this.embeddedChunks.get(chunkId);
        if (chunk) {
          chunks.push(chunk);
        }
      });
    });
    
    return chunks;
  }

  /**
   * Search for similar chunks
   */
  async search(
    query: string,
    pdfIds: string[],
    topK: number = 5
  ): Promise<SearchResult[]> {
    console.log(`Vector store search: query="${query}", pdfIds=[${pdfIds.join(', ')}], topK=${topK}`);
    
    const { EmbeddingService } = await import('./embeddingService');
    
    // Generate embedding for the query
    const queryEmbedding = await EmbeddingService.generateEmbedding(query, this.config.apiKey);
    console.log('Query embedding generated, dimension:', queryEmbedding.length);
    
    // Get chunks for the specified PDFs
    const relevantChunks = this.getChunksForPDFs(pdfIds);
    console.log(`Found ${relevantChunks.length} relevant chunks for PDFs: [${pdfIds.join(', ')}]`);
    
    if (relevantChunks.length === 0) {
      console.log('No relevant chunks found for the specified PDFs');
      return [];
    }
    
    // Find similar chunks
    const similarChunks = EmbeddingService.findSimilarChunks(
      queryEmbedding,
      relevantChunks,
      topK
    );
    
    console.log(`Found ${similarChunks.length} similar chunks`);
    
    // Convert to search results with scores
    return similarChunks.map(({ chunk, similarity }) => ({
      chunk,
      similarity,
      score: similarity, // Can be enhanced with additional scoring logic
    }));
  }

  /**
   * Get statistics about the vector store
   */
  getStats(): {
    totalChunks: number;
    totalPDFs: number;
    chunksPerPDF: Record<string, number>;
  } {
    const chunksPerPDF: Record<string, number> = {};
    
    this.pdfChunks.forEach((chunkIds, pdfId) => {
      chunksPerPDF[pdfId] = chunkIds.length;
    });
    
    return {
      totalChunks: this.embeddedChunks.size,
      totalPDFs: this.pdfChunks.size,
      chunksPerPDF,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.embeddedChunks.clear();
    this.pdfChunks.clear();
  }

  /**
   * Export data for persistence
   */
  exportData(): {
    embeddedChunks: EmbeddedChunk[];
    pdfChunks: Record<string, string[]>;
  } {
    const embeddedChunks = Array.from(this.embeddedChunks.values());
    const pdfChunks: Record<string, string[]> = {};
    
    this.pdfChunks.forEach((chunkIds, pdfId) => {
      pdfChunks[pdfId] = chunkIds;
    });
    
    return { embeddedChunks, pdfChunks };
  }

  /**
   * Import data from persistence
   */
  importData(data: {
    embeddedChunks: EmbeddedChunk[];
    pdfChunks: Record<string, string[]>;
  }): void {
    this.clear();
    
    data.embeddedChunks.forEach(chunk => {
      this.embeddedChunks.set(chunk.id, chunk);
    });
    
    Object.entries(data.pdfChunks).forEach(([pdfId, chunkIds]) => {
      this.pdfChunks.set(pdfId, chunkIds);
    });
  }
}
