import express from 'express';
import * as receiptController from '../controllers/receiptController';

const router = express.Router();

// Receipt parsing route (spelling per requirement: /reciepts/parse)
router.post('/parse', receiptController.parseReceipt);

// Expense splitting route
router.post('/split', receiptController.splitExpense);

export default router;
