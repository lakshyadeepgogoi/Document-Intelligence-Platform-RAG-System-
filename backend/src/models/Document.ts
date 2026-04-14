import mongoose, { Schema, Document } from 'mongoose';

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface IDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  originalName: string;
  mimeType: string;
  size: number;
  cloudinaryUrl?: string;
  cloudinaryPublicId?: string;
  status: DocumentStatus;
  errorMessage?: string;
  chunkCount: number;
  uploadedAt: Date;
  processedAt?: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    cloudinaryUrl: { type: String },
    cloudinaryPublicId: { type: String },
    status: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'failed'],
      default: 'pending',
      index: true,
    },
    errorMessage: { type: String },
    chunkCount: { type: Number, default: 0 },
    processedAt: { type: Date },
  },
  { timestamps: { createdAt: 'uploadedAt', updatedAt: 'updatedAt' } }
);

export const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);
