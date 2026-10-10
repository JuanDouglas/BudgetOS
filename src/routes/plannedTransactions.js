import { Router } from 'express';
import * as plannedController from '../controllers/plannedTransactionController.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveWorkspaceContext } from '../middleware/workspaceContext.js';
import { validate } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createPlannedTransactionSchema, updatePlannedTransactionSchema, 
  plannedTransactionIdParamSchema, listPlannedTransactionsQuerySchema, createOccurrenceSchema } from '../validators/plannedTransactions.js';

const router = Router();

router.use(requireAuth);
router.use(resolveWorkspaceContext);

router.post('/', validate({ body: createPlannedTransactionSchema }), asyncHandler(plannedController.createPlannedTransaction));
router.get('/', validate({ query: listPlannedTransactionsQuerySchema }), asyncHandler(plannedController.getPlannedTransactions));
router.get('/upcoming', asyncHandler(plannedController.getUpcoming));
router.get('/:id', validate({ params: plannedTransactionIdParamSchema }), asyncHandler(plannedController.getPlannedTransaction));
router.put('/:id', validate({ params: plannedTransactionIdParamSchema, body: updatePlannedTransactionSchema }), asyncHandler(plannedController.updatePlannedTransaction));
router.delete('/:id', validate({ params: plannedTransactionIdParamSchema }), asyncHandler(plannedController.deletePlannedTransaction));
router.post('/:id/occurrence', validate({ params: plannedTransactionIdParamSchema, body: createOccurrenceSchema }), asyncHandler(plannedController.createOccurrence));
router.post('/:id/reconcile', validate({ params: plannedTransactionIdParamSchema }), asyncHandler(plannedController.reconcileOccurrences));

export default router;
