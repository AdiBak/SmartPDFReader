import { TextChunk } from './textChunker';

export interface EmbeddedChunk extends TextChunk {
  embedding: number[];
  embeddingModel: string;
  embeddedAt: Date;
}

export interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class EmbeddingService {
  private static readonly MISTRAL_API_URL = 'https://api.mistral.ai/v1/embeddings';
  private static readonly MAX_BATCH_SIZE = 100; // Mistral's limit

  /**
   * Generate embeddings for text chunks
   */
  static async generateEmbeddings(
    chunks: TextChunk[],
    apiKey: string
  ): Promise<EmbeddedChunk[]> {
    if (!apiKey) {
      throw new Error('Mistral API key is required');
    }

    const embeddedChunks: EmbeddedChunk[] = [];
    
    // Process in batches to respect API limits
    for (let i = 0; i < chunks.length; i += this.MAX_BATCH_SIZE) {
      const batch = chunks.slice(i, i + this.MAX_BATCH_SIZE);
      const batchEmbeddings = await this.generateBatchEmbeddings(batch, apiKey);
      embeddedChunks.push(...batchEmbeddings);
    }
    
    return embeddedChunks;
  }

  /**
   * Generate embeddings for a batch of chunks
   */
  private static async generateBatchEmbeddings(
    chunks: TextChunk[],
    apiKey: string
  ): Promise<EmbeddedChunk[]> {
    try {
      const response = await fetch(this.MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-embed',
          input: chunks.map(chunk => chunk.text),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Mistral API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      
      // Map embeddings back to chunks
      return chunks.map((chunk, index) => ({
        ...chunk,
        embedding: data.data[index].embedding,
        embeddingModel: data.model,
        embeddedAt: new Date(),
      }));
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw new Error(`Failed to generate embeddings: ${error}`);
    }
  }

  /**
   * Generate embedding for a single text
   */
  static async generateEmbedding(
    text: string,
    apiKey: string
  ): Promise<number[]> {
    try {
      const response = await fetch(this.MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-embed',
          input: [text],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Mistral API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Find most similar chunks using cosine similarity
   */
  static findSimilarChunks(
    queryEmbedding: number[],
    embeddedChunks: EmbeddedChunk[],
    topK: number = 5
  ): Array<{ chunk: EmbeddedChunk; similarity: number }> {
    console.log(`Finding similar chunks: ${embeddedChunks.length} chunks available`);
    
    const similarities = embeddedChunks.map(chunk => ({
      chunk,
      similarity: this.calculateSimilarity(queryEmbedding, chunk.embedding),
    }));

    // Log similarity scores for debugging
    const sortedSimilarities = similarities
      .sort((a, b) => b.similarity - a.similarity);
    
    console.log('Top similarity scores:', sortedSimilarities.slice(0, 5).map(s => ({
      pdfName: s.chunk.pdfName,
      similarity: s.similarity.toFixed(4),
      textPreview: s.chunk.text.substring(0, 100) + '...'
    })));

    // Return top K
    return sortedSimilarities.slice(0, topK);
  }
}
