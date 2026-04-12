import EventEmitter from 'events';
import { DocumentModel } from '../models/Document';
import { Chunk } from '../models/Chunk';
import { extractText } from '../services/document/extractor';
import { chunkText } from '../services/document/chunker';
import { embedTexts } from '../services/document/embedder';
import mongoose from 'mongoose';

interface ProcessingJob {
  documentId: string;
  userId: string;
  filePath: string;
  mimeType: string;
  originalName: string;
}

/**
 * Simple in-process job queue using Node.js EventEmitter.
 * Jobs run asynchronously without blocking the HTTP request cycle.
 * No Redis needed — all state tracked in MongoDB.
 */
class DocumentProcessingQueue extends EventEmitter {
  private processing = false;
  private queue: ProcessingJob[] = [];

  enqueue(job: ProcessingJob): void {
    this.queue.push(job);
    if (!this.processing) {
      this.processNext();
    }
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const job = this.queue.shift()!;

    try {
      await this.processDocument(job);
    } catch (err) {
      console.error(`[Queue] Failed to process document ${job.documentId}:`, err);
    }

    // Process next job without awaiting (fire-and-forget loop)
    setImmediate(() => this.processNext());
  }

  private async processDocument(job: ProcessingJob): Promise<void> {
    const { documentId, userId, filePath, mimeType } = job;

    try {
      // 1. Mark as processing
      await DocumentModel.findByIdAndUpdate(documentId, { status: 'processing' });
      console.log(`[Processor] Starting: ${job.originalName}`);

      // 2. Extract text
      const extracted = await extractText(filePath, mimeType);
      if (!extracted.text || extracted.text.trim().length < 10) {
        throw new Error('Extracted text is empty or too short');
      }

      // 3. Chunk text
      const chunks = chunkText(extracted.text);
      if (chunks.length === 0) throw new Error('No chunks generated');
      console.log(`[Processor] ${chunks.length} chunks created for ${job.originalName}`);

      // 4. Generate embeddings in batches
      const texts = chunks.map((c) => c.content);
      const embeddings = await embedTexts(texts);

      // 5. Insert all chunks atomically
      const chunkDocs = chunks.map((chunk, i) => ({
        documentId: new mongoose.Types.ObjectId(documentId),
        userId: new mongoose.Types.ObjectId(userId),
        content: chunk.content,
        embedding: embeddings[i],
        metadata: {
          page: extracted.pages,
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          startChar: chunk.startChar,
          endChar: chunk.endChar,
        },
      }));

      await Chunk.insertMany(chunkDocs, { ordered: false });

      // 6. Mark as ready
      await DocumentModel.findByIdAndUpdate(documentId, {
        status: 'ready',
        chunkCount: chunks.length,
        processedAt: new Date(),
      });

      console.log(`[Processor] ✅ Done: ${job.originalName} (${chunks.length} chunks)`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown processing error';
      console.error(`[Processor] ❌ Failed: ${job.originalName}`, message);
      await DocumentModel.findByIdAndUpdate(documentId, {
        status: 'failed',
        errorMessage: message,
      });
    }
  }
}

// Singleton queue instance
export const documentQueue = new DocumentProcessingQueue();
