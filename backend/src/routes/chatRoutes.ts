import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createChat,
  getChats,
  getChatById,
  sendMessage,
  deleteChat,
  updateChatScope,
} from '../controllers/chatController';

const router = Router();

router.use(authenticate);

router.post('/', createChat);
router.get('/', getChats);
router.get('/:chatId', getChatById);
router.post('/:chatId/messages', sendMessage);
router.patch('/:chatId/scope', updateChatScope);
router.delete('/:chatId', deleteChat);

export default router;
