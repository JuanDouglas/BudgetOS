import { Router } from 'express';
import * as creditCardController from '../controllers/creditCardController.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveWorkspaceContext } from '../middleware/workspaceContext.js';
import { validate } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createCreditCardSchema, updateCreditCardSchema, creditCardIdParamSchema, listCyclesQuerySchema } from '../validators/creditCards.js';

const router = Router();

router.use(requireAuth);
router.use(resolveWorkspaceContext);

router.post('/', validate({ body: createCreditCardSchema }), asyncHandler(creditCardController.createCreditCard));
router.get('/', asyncHandler(creditCardController.getCreditCards));
router.get('/:id', validate({ params: creditCardIdParamSchema }), asyncHandler(creditCardController.getCreditCard));
router.put('/:id', validate({ params: creditCardIdParamSchema, body: updateCreditCardSchema }), asyncHandler(creditCardController.updateCreditCard));
router.delete('/:id', validate({ params: creditCardIdParamSchema }), asyncHandler(creditCardController.deleteCreditCard));
router.get('/:id/cycles', validate({ params: creditCardIdParamSchema, query: listCyclesQuerySchema }), asyncHandler(creditCardController.getCycles));
router.get('/:id/cycles/current', validate({ params: creditCardIdParamSchema }), asyncHandler(creditCardController.getCurrentCycle));
router.get('/:id/cycles/:cycleId/transactions', asyncHandler(creditCardController.getCycleTransactions));
router.post('/:id/cycles/:cycleId/debit', asyncHandler(creditCardController.generateCycleDebit));

export default router;
