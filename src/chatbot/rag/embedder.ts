/**
 * Embedding Service
 * Generates vector embeddings using OpenAI text-embedding-3-small.
 */
import OpenAI from 'openai';

const MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 100; // OpenAI allows up to 2048 inputs, but keep batches small

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for embeddings');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Generate embedding for a single text
 */
export async function embed(text: string): Promise<number[]> {
  const client = getClient();
  const response = await client.embeddings.create({
    model: MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batches
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const client = getClient();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({
      model: MODEL,
      input: batch,
    });
    for (const item of response.data) {
      embeddings.push(item.embedding);
    }
  }

  return embeddings;
}
