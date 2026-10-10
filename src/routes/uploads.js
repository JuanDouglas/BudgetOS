import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveWorkspaceContext } from '../middleware/workspaceContext.js';
import { upload, uploadPayeeImage, deletePayeeImage } from '../controllers/uploadController.js';

const router = Router();

router.use(requireAuth);
router.use(resolveWorkspaceContext);

// Image upload for a payee
router.post('/payee-image', upload.single('image'), uploadPayeeImage);

// Image deletion
router.delete('/payee-image', deletePayeeImage);

export default router;
