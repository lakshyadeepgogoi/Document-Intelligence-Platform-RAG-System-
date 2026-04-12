import mongoose, { Schema, Document } from 'mongoose';

export interface ICitation {
  documentId: string;
  documentName: string;
  chunkId: string;
  content: string;
  page?: number;
}

export interface IMessage {
  _id: mongoose.Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  citations?: ICitation[];
  followUpQuestions?: string[];
  createdAt: Date;
}

export interface IChat extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  scopedDocumentIds: mongoose.Types.ObjectId[];
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const citationSchema = new Schema<ICitation>(
  {
    documentId: { type: String, required: true },
    documentName: { type: String, required: true },
    chunkId: { type: String, required: true },
    content: { type: String, required: true },
    page: { type: Number },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage>({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  citations: [citationSchema],
  followUpQuestions: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

const chatSchema = new Schema<IChat>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    scopedDocumentIds: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
    messages: [messageSchema],
  },
  { timestamps: true }
);

export const Chat = mongoose.model<IChat>('Chat', chatSchema);
