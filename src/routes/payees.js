import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveWorkspaceContext } from '../middleware/workspaceContext.js';
import {
  getPayees,
  getPayee,
  createPayee,
  updatePayee,
  deletePayee,
  getPayeeTransactionCount,
  reassignPayeeTransactions,
} from '../controllers/payeeController.js';

const router = Router();

router.use(requireAuth);
router.use(resolveWorkspaceContext);

router.get('/', getPayees);
router.get('/:id', getPayee);
router.get('/:id/transactions/count', getPayeeTransactionCount);
router.post('/:id/transactions/reassign', reassignPayeeTransactions);
router.post('/', createPayee);
router.put('/:id', updatePayee);
router.delete('/:id', deletePayee);

export default router;
