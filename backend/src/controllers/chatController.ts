import { Request, Response } from 'express';
import { Chat } from '../models/Chat';
import { DocumentModel } from '../models/Document';
import { runRAGOrchestrator } from '../services/chat/orchestrator';
import { asyncHandler, createError } from '../middleware/errorHandler';

export const createChat = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const { title, scopedDocumentIds } = req.body;

  // Validate scoped document ownership
  if (scopedDocumentIds?.length) {
    const docs = await DocumentModel.find({
      _id: { $in: scopedDocumentIds },
      userId,
      status: 'ready',
    });
    if (docs.length !== scopedDocumentIds.length) {
      throw createError('One or more documents not found or not ready', 400);
    }
  }

  const chat = await Chat.create({
    userId,
    title: title || 'New Chat',
    scopedDocumentIds: scopedDocumentIds || [],
    messages: [],
  });

  res.status(201).json({ success: true, chat });
});

export const getChats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const chats = await Chat.find({ userId })
    .sort({ updatedAt: -1 })
    .select('title scopedDocumentIds createdAt updatedAt')
    .populate('scopedDocumentIds', 'originalName status');

  res.json({ success: true, chats });
});

export const getChatById = asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = req.user!._id;

  const chat = await Chat.findOne({ _id: chatId, userId }).populate(
    'scopedDocumentIds',
    'originalName status mimeType'
  );
  if (!chat) throw createError('Chat not found', 404);

  res.json({ success: true, chat });
});

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = req.user!._id;
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw createError('Message content is required', 400);
  }

  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) throw createError('Chat not found', 404);

  // Add user message
  chat.messages.push({ role: 'user', content: content.trim() } as any);

  // Build recent conversation history for context
  const history = chat.messages.slice(-10).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Determine document scope
  const scopedIds =
    chat.scopedDocumentIds.length > 0
      ? chat.scopedDocumentIds.map((id) => id.toString())
      : null;

  // Run the multi-step RAG orchestrator
  const result = await runRAGOrchestrator(content.trim(), userId.toString(), scopedIds, history);

  // Add assistant message with citations and follow-ups
  chat.messages.push({
    role: 'assistant',
    content: result.answer,
    citations: result.citations,
    followUpQuestions: result.followUpQuestions,
  } as any);

  // Auto-generate title from first user message if still default
  if (chat.title === 'New Chat' && chat.messages.length === 2) {
    chat.title = content.trim().slice(0, 60) + (content.length > 60 ? '...' : '');
  }

  await chat.save();

  const lastMessage = chat.messages[chat.messages.length - 1];

  res.json({
    success: true,
    message: lastMessage,
    stepsLog: result.stepsLog,
  });
});

export const deleteChat = asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = req.user!._id;

  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) throw createError('Chat not found', 404);

  await Chat.deleteOne({ _id: chatId });
  res.json({ success: true, message: 'Chat deleted' });
});

export const updateChatScope = asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = req.user!._id;
  const { scopedDocumentIds } = req.body;

  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) throw createError('Chat not found', 404);

  chat.scopedDocumentIds = scopedDocumentIds || [];
  await chat.save();

  res.json({ success: true, chat });
});
