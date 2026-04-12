export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Document {
  _id: string;
  userId: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  chunkCount: number;
  errorMessage?: string;
  uploadedAt: string;
  processedAt?: string;
}

export interface Citation {
  documentId: string;
  documentName: string;
  chunkId: string;
  content: string;
  page?: number;
}

export interface Message {
  _id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  followUpQuestions?: string[];
  createdAt: string;
}

export interface Chat {
  _id: string;
  userId: string;
  title: string;
  scopedDocumentIds: (string | Document)[];
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}
