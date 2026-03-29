/**
 * Vector Store
 * Similarity search over document chunks.
 * Uses pgvector on PostgreSQL, in-memory cosine similarity on SQLite.
 */
import { getKnex } from '../../storage/knex-client.js';

export interface SearchResult {
  chunkId: string;
  content: string;
  similarity: number;
  documentId: string;
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search for similar chunks using vector similarity.
 * @param chatbotId - Filter by chatbot
 * @param queryEmbedding - Query vector (1536 dimensions)
 * @param topK - Number of results to return
 * @param similarityThreshold - Minimum similarity score (0-1)
 */
export async function searchSimilarChunks(
  chatbotId: string,
  queryEmbedding: number[],
  topK: number = 3,
  similarityThreshold: number = 0.5
): Promise<SearchResult[]> {
  const knex = getKnex();
  const client = knex.client.config.client;
  const isPg = client === 'pg' || client === 'postgresql';

  if (isPg) {
    return searchPgVector(chatbotId, queryEmbedding, topK, similarityThreshold);
  }
  return searchSqliteFallback(chatbotId, queryEmbedding, topK, similarityThreshold);
}

/**
 * PostgreSQL + pgvector search
 */
async function searchPgVector(
  chatbotId: string,
  queryEmbedding: number[],
  topK: number,
  similarityThreshold: number
): Promise<SearchResult[]> {
  const knex = getKnex();
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const results = await knex.raw(
    `SELECT id, content, document_id, 1 - (embedding <=> ?::vector) as similarity
     FROM document_chunks
     WHERE chatbot_id = ?
       AND embedding IS NOT NULL
     ORDER BY embedding <=> ?::vector
     LIMIT ?`,
    [vectorStr, chatbotId, vectorStr, topK]
  );

  return (results.rows || [])
    .filter((r: { similarity: number }) => r.similarity >= similarityThreshold)
    .map((r: { id: string; content: string; similarity: number; document_id: string }) => ({
      chunkId: r.id,
      content: r.content,
      similarity: r.similarity,
      documentId: r.document_id,
    }));
}

/**
 * SQLite fallback: load all embeddings and compute cosine similarity in-memory
 */
async function searchSqliteFallback(
  chatbotId: string,
  queryEmbedding: number[],
  topK: number,
  similarityThreshold: number
): Promise<SearchResult[]> {
  const knex = getKnex();

  const chunks = await knex('document_chunks')
    .where({ chatbot_id: chatbotId })
    .whereNotNull('embedding_json')
    .select('id', 'content', 'document_id', 'embedding_json');

  const scored = chunks
    .map(chunk => {
      const embedding = JSON.parse(chunk.embedding_json) as number[];
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      return {
        chunkId: chunk.id as string,
        content: chunk.content as string,
        similarity,
        documentId: chunk.document_id as string,
      };
    })
    .filter(r => r.similarity >= similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return scored;
}
