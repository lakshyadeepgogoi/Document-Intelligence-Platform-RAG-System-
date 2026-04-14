import EventEmitter from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

import { DocumentModel } from '../models/Document';
import { Chunk } from '../models/Chunk';
import { extractText } from '../services/document/extractor';
import { chunkText } from '../services/document/chunker';
import { embedTexts } from '../services/document/embedder';
import { downloadAsBuffer, deleteFile } from '../services/storage/cloudinary';

interface ProcessingJob {
  documentId: string;
  userId: string;
  fileUrl: string;
  mimeType: string;
  originalName: string;
}

/**
 * Simple in-process job queue using Node.js EventEmitter.
 * Jobs run asynchronously without blocking the HTTP request cycle.
 * Files are fetched from Cloudinary, extracted, then discarded.
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
    const { documentId, userId, fileUrl, mimeType, originalName } = job;
    const ext = path.extname(originalName) || '';
    const tmpPath = path.join(os.tmpdir(), `${uuidv4()}${ext}`);

    try {
      // 1. Mark as processing
      await DocumentModel.findByIdAndUpdate(documentId, { status: 'processing' });
      console.log(`[Processor] Starting: ${originalName}`);

      // 2. Download file from Cloudinary to /tmp
      const buffer = await downloadAsBuffer(fileUrl);
      fs.writeFileSync(tmpPath, buffer);

      // 3. Extract text
      const extracted = await extractText(tmpPath, mimeType);
      if (!extracted.text || extracted.text.trim().length < 10) {
        throw new Error('Extracted text is empty or too short');
      }

      // 4. Chunk text
      const chunks = chunkText(extracted.text);
      if (chunks.length === 0) throw new Error('No chunks generated');
      console.log(`[Processor] ${chunks.length} chunks created for ${originalName}`);

      // 5. Generate embeddings in batches
      const texts = chunks.map((c) => c.content);
      const embeddings = await embedTexts(texts);

      // 6. Insert all chunks atomically
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

      // 7. Mark as ready + clean up Cloudinary file (we only need the embeddings now)
      const doc = await DocumentModel.findByIdAndUpdate(documentId, {
        status: 'ready',
        chunkCount: chunks.length,
        processedAt: new Date(),
      });

      if (doc?.cloudinaryPublicId) {
        await deleteFile(doc.cloudinaryPublicId);
        await DocumentModel.findByIdAndUpdate(documentId, {
          $unset: { cloudinaryUrl: '', cloudinaryPublicId: '' },
        });
      }

      console.log(`[Processor] ✅ Done: ${originalName} (${chunks.length} chunks)`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown processing error';
      console.error(`[Processor] ❌ Failed: ${originalName}`, message);
      await DocumentModel.findByIdAndUpdate(documentId, {
        status: 'failed',
        errorMessage: message,
      });
    } finally {
      // Clean up temp file
      if (fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          /* ignore */
        }
      }
    }
  }
}

// Singleton queue instance
export const documentQueue = new DocumentProcessingQueue();
