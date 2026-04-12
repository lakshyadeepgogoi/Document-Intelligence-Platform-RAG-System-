import { Chunk, IChunk } from '../../models/Chunk';
import { embedQuery } from '../document/embedder';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  metadata: IChunk['metadata'];
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Retrieve top-K relevant chunks for a query using cosine similarity.
 * Filters by userId and optionally by specific documentIds (scoped search).
 */
export async function retrieveRelevantChunks(
  query: string,
  userId: string,
  documentIds: string[] | null, // null = all user docs
  topK = 20
): Promise<RetrievedChunk[]> {
  // Embed the query
  const queryEmbedding = await embedQuery(query);

  // Build filter — strict user isolation
  const filter: Record<string, unknown> = { userId };
  if (documentIds && documentIds.length > 0) {
    filter.documentId = { $in: documentIds };
  }

  // Fetch all candidate chunks (only embedding + metadata fields)
  const chunks = await Chunk.find(filter, {
    content: 1,
    embedding: 1,
    documentId: 1,
    metadata: 1,
  }).lean();

  if (chunks.length === 0) return [];

  // Score each chunk
  const scored = chunks.map((chunk) => ({
    chunkId: chunk._id.toString(),
    documentId: chunk.documentId.toString(),
    content: chunk.content,
    metadata: chunk.metadata,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort by score descending and return top-K
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
