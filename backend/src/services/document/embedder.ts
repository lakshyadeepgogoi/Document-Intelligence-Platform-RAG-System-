import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 100;

export const EMBEDDING_DIM = EMBEDDING_DIMENSIONS;

/**
 * Generate embeddings for a batch of texts using Gemini embedding model.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];
  const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const result = await embeddingModel.batchEmbedContents({
      requests: batch.map((text) => ({
        content: { role: 'user', parts: [{ text }] },
      })),
    });

    allEmbeddings.push(...result.embeddings.map((e) => e.values));
  }

  return allEmbeddings;
}

/**
 * Generate a single embedding for query text.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const embeddings = await embedTexts([query]);
  return embeddings[0];
}
