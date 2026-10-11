import { Router } from 'express';
import * as workspaceController from '../controllers/workspaceController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { createWorkspaceSchema, workspaceIdParamSchema } from '../validators/workspaces.js';

const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(workspaceController.listWorkspaces));
router.post('/', validate({ body: createWorkspaceSchema }), asyncHandler(workspaceController.createWorkspace));
router.post('/:workspaceId/activate', validate({ params: workspaceIdParamSchema }), asyncHandler(workspaceController.activateWorkspace));
router.post('/:workspaceId/deactivate', validate({ params: workspaceIdParamSchema }), asyncHandler(workspaceController.deactivateWorkspace));
router.post('/:workspaceId/reactivate', validate({ params: workspaceIdParamSchema }), asyncHandler(workspaceController.reactivateWorkspace));
router.delete('/:workspaceId', validate({ params: workspaceIdParamSchema }), asyncHandler(workspaceController.deleteWorkspace));

export default router;
