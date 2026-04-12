import mongoose, { Schema, Document } from 'mongoose';

export interface IChunk extends Document {
  _id: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  content: string;
  embedding: number[];
  metadata: {
    page?: number;
    section?: string;
    chunkIndex: number;
    totalChunks: number;
    startChar: number;
    endChar: number;
  };
}

const chunkSchema = new Schema<IChunk>({
  documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  content: { type: String, required: true },
  embedding: { type: [Number], required: true },
  metadata: {
    page: { type: Number },
    section: { type: String },
    chunkIndex: { type: Number, required: true },
    totalChunks: { type: Number, required: true },
    startChar: { type: Number, required: true },
    endChar: { type: Number, required: true },
  },
});

// Atlas Vector Search index must be created manually in Atlas UI:
// Field: embedding, Dimensions: 768, Similarity: cosine
chunkSchema.index({ documentId: 1, 'metadata.chunkIndex': 1 });

export const Chunk = mongoose.model<IChunk>('Chunk', chunkSchema);
