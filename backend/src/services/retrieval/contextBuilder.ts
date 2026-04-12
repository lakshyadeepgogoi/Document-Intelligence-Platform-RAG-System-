import { RetrievedChunk } from './vectorSearch';
import { DocumentModel } from '../../models/Document';

export interface BuiltContext {
  contextText: string;
  citations: Array<{
    chunkId: string;
    documentId: string;
    documentName: string;
    content: string;
    page?: number;
  }>;
}

/**
 * Builds the context string injected into the LLM prompt.
 * Resolves document names and formats chunks with numeric references [1], [2], …
 */
export async function buildContext(chunks: RetrievedChunk[]): Promise<BuiltContext> {
  // Resolve document names (batch)
  const uniqueDocIds = [...new Set(chunks.map((c) => c.documentId))];
  const docs = await DocumentModel.find({ _id: { $in: uniqueDocIds } }, { originalName: 1 }).lean();
  const docNameMap = new Map(docs.map((d) => [d._id.toString(), d.originalName]));

  const citations = chunks.map((chunk, i) => ({
    ref: i + 1,
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    documentName: docNameMap.get(chunk.documentId) || 'Unknown Document',
    content: chunk.content,
    page: chunk.metadata.page,
  }));

  // Build the context block that will be injected into the system prompt
  const contextText = citations
    .map(
      (c) =>
        `[Source ${c.ref}] — ${c.documentName}${c.page ? ` (page ${c.page})` : ''}\n${c.content}`
    )
    .join('\n\n---\n\n');

  return {
    contextText,
    citations: citations.map(({ ref: _ref, ...rest }) => rest),
  };
}
