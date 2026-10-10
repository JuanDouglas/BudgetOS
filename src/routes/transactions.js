import { Router } from 'express';
import * as transactionController from '../controllers/transactionController.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveWorkspaceContext } from '../middleware/workspaceContext.js';
import { validate } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createTransactionSchema, updateTransactionSchema, transactionIdParamSchema, 
  listTransactionsQuerySchema, reconcileTransactionsSchema, createSplitTransactionSchema } from '../validators/transactions.js';

const router = Router();

router.use(requireAuth);
router.use(resolveWorkspaceContext);

router.post('/', validate({ body: createTransactionSchema }), asyncHandler(transactionController.createTransaction));
router.get('/', validate({ query: listTransactionsQuerySchema }), asyncHandler(transactionController.getTransactions));
router.post('/split', validate({ body: createSplitTransactionSchema }), asyncHandler(transactionController.createSplitTransaction));
router.post('/reconcile', validate({ body: reconcileTransactionsSchema }), asyncHandler(transactionController.reconcileTransactions));
router.get('/match', asyncHandler(transactionController.findMatchingTransactions));
router.get('/:id', validate({ params: transactionIdParamSchema }), asyncHandler(transactionController.getTransaction));
router.put('/:id', validate({ params: transactionIdParamSchema, body: updateTransactionSchema }), asyncHandler(transactionController.updateTransaction));
router.patch('/:id/reconcile', validate({ params: transactionIdParamSchema }), asyncHandler(transactionController.toggleReconcile));
router.delete('/:id', validate({ params: transactionIdParamSchema }), asyncHandler(transactionController.deleteTransaction));

export default router;
