import { Router } from 'express';
import * as accountController from '../controllers/accountController.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveWorkspaceContext } from '../middleware/workspaceContext.js';
import { validate } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createAccountSchema, updateAccountSchema, accountIdParamSchema, listAccountsQuerySchema } from '../validators/accounts.js';

const router = Router();

router.use(requireAuth);
router.use(resolveWorkspaceContext);

router.post('/', validate({ body: createAccountSchema }), asyncHandler(accountController.createAccount));
router.get('/', validate({ query: listAccountsQuerySchema }), asyncHandler(accountController.getAccounts));
router.post('/recalculate', asyncHandler(accountController.recalculateBalances));
router.get('/:id', validate({ params: accountIdParamSchema }), asyncHandler(accountController.getAccount));
router.put('/:id', validate({ params: accountIdParamSchema, body: updateAccountSchema }), asyncHandler(accountController.updateAccount));
router.delete('/:id', validate({ params: accountIdParamSchema }), asyncHandler(accountController.deleteAccount));
router.post('/:id/deactivate', validate({ params: accountIdParamSchema }), asyncHandler(accountController.deactivateAccount));
router.post('/:id/reactivate', validate({ params: accountIdParamSchema }), asyncHandler(accountController.reactivateAccount));
router.get('/:id/stats', validate({ params: accountIdParamSchema }), asyncHandler(accountController.getAccountStats));

export default router;
