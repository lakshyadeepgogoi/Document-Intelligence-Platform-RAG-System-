import { Request, Response } from 'express';
import { DocumentModel } from '../models/Document';
import { Chunk } from '../models/Chunk';
import { documentQueue } from '../workers/documentProcessor';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { uploadBuffer, deleteFile } from '../services/storage/cloudinary';

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw createError('No file uploaded', 400);

  const userId = req.user!._id.toString();
  const { originalname, mimetype, size, buffer } = req.file;

  // Upload file to Cloudinary
  const uploaded = await uploadBuffer(buffer, {
    folder: `docint/${userId}`,
    filename: originalname,
  });

  // Persist document record
  const doc = await DocumentModel.create({
    userId,
    originalName: originalname,
    mimeType: mimetype,
    size,
    cloudinaryUrl: uploaded.url,
    cloudinaryPublicId: uploaded.publicId,
    status: 'pending',
  });

  // Enqueue background processing — does NOT block response
  documentQueue.enqueue({
    documentId: doc._id.toString(),
    userId,
    fileUrl: uploaded.url,
    mimeType: mimetype,
    originalName: originalname,
  });

  res.status(201).json({
    success: true,
    message: 'Document uploaded. Processing started in background.',
    document: {
      id: doc._id,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      size: doc.size,
      status: doc.status,
      uploadedAt: doc.uploadedAt,
    },
  });
});

export const getDocuments = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const docs = await DocumentModel.find({ userId })
    .sort({ uploadedAt: -1 })
    .select('-__v');

  res.json({ success: true, documents: docs });
});

export const getDocumentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!._id;

  const doc = await DocumentModel.findOne({ _id: id, userId }).select(
    'status chunkCount errorMessage processedAt'
  );
  if (!doc) throw createError('Document not found', 404);

  res.json({ success: true, status: doc.status, chunkCount: doc.chunkCount, errorMessage: doc.errorMessage });
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!._id;

  const doc = await DocumentModel.findOne({ _id: id, userId });
  if (!doc) throw createError('Document not found', 404);

  // Delete file from Cloudinary (if still there)
  if (doc.cloudinaryPublicId) {
    await deleteFile(doc.cloudinaryPublicId);
  }

  // Delete all associated chunks
  await Chunk.deleteMany({ documentId: id });

  // Delete the document record
  await DocumentModel.deleteOne({ _id: id });

  res.json({ success: true, message: 'Document deleted successfully' });
});
