import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';
import {
  uploadDocument,
  getDocuments,
  getDocumentStatus,
  deleteDocument,
} from '../controllers/documentController';

const router = Router();

router.use(authenticate);

router.post('/upload', upload.single('file'), uploadDocument);
router.get('/', getDocuments);
router.get('/:id/status', getDocumentStatus);
router.delete('/:id', deleteDocument);

export default router;
