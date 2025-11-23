import { Request, Response } from 'express';
import { brokerService } from '../services/brokerService';

/**
 * @swagger
 * /reciepts/parse:
 *   post:
 *     summary: Parse a receipt image into structured JSON
 *     tags: [Receipts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               imageUrl:
 *                 type: string
 *                 description: Publicly accessible URL to the receipt image
 *               base64Image:
 *                 type: string
 *                 description: Base64-encoded image string (with or without data URL prefix)
 *             oneOf:
 *               - required: [imageUrl]
 *               - required: [base64Image]
 *     responses:
 *       200:
 *         description: Receipt parsed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 receipt:
 *                   type: object
 *                   properties:
 *                     currency:
 *                       type: string
 *                       nullable: true
 *                     total:
 *                       type: number
 *                       nullable: true
 *                     subtotal:
 *                       type: number
 *                       nullable: true
 *                     tax:
 *                       type: number
 *                       nullable: true
 *                     tip:
 *                       type: number
 *                       nullable: true
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           price:
 *                             type: number
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     model:
 *                       type: string
 *                     provider:
 *                       type: string
 *                     isValid:
 *                       type: boolean
 *                       nullable: true
 *                     chatId:
 *                       type: string
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const parseReceipt = async (req: Request, res: Response) => {
  try {
    console.log("parseReceipt endpoint called");
    const { imageUrl, base64Image } = req.body;

    if (!imageUrl && !base64Image) {
      return res.status(400).json({ 
        success: false, 
        error: 'Either imageUrl or base64Image is required' 
      });
    }

    if (imageUrl && typeof imageUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'imageUrl must be a string' });
    }

    if (base64Image && typeof base64Image !== 'string') {
      return res.status(400).json({ success: false, error: 'base64Image must be a string' });
    }

    // TESTING MODE: Set to true to use mock responses without spending credits
    const USE_MOCK_TESTING = false;
    
    if (USE_MOCK_TESTING) {
      console.log("Using MOCK testing mode for parseReceipt");
      // Simulate network delay (1-3 seconds)
      const delay = Math.floor(Math.random() * 2000) + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Randomly succeed (70%) or fail (30%)
      const shouldSucceed = Math.random() > 0.3;
      
      if (shouldSucceed) {
        console.log(`[MOCK] Parse receipt succeeded after ${delay}ms`);
        return res.status(200).json({
          success: true,
          receipt: {
            currency: 'USD',
            total: 36.8,
            subtotal: 32,
            tax: 0,
            tip: 4.8,
            items: [
              { name: 'TACOS', price: 20 },
              { name: 'DIET COKE', price: 2 },
              { name: 'SMART WATER', price: 3 },
              { name: 'CAKE', price: 7 }
            ]
          },
          metadata: {
            model: 'mock-vision-model',
            provider: '0xMOCK',
            isValid: true,
            chatId: `mock-${Date.now()}`
          }
        });
      } else {
        console.log(`[MOCK] Parse receipt failed after ${delay}ms`);
        return res.status(500).json({
          success: false,
          error: 'Mock error: Unable to process receipt image. Please try again.'
        });
      }
    }

    const { receipt, metadata } = await brokerService.parseReceipt(imageUrl, base64Image);

    return res.status(200).json({ success: true, receipt, metadata });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * @swagger
 * /reciepts/split:
 *   post:
 *     summary: Split expenses among participants using AI reasoning
 *     tags: [Receipts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receipt
 *               - instructions
 *               - participants
 *             properties:
 *               receipt:
 *                 type: object
 *                 description: Parsed receipt JSON (from /parse endpoint or manual input)
 *                 properties:
 *                   currency:
 *                     type: string
 *                   total:
 *                     type: number
 *                   subtotal:
 *                     type: number
 *                   tax:
 *                     type: number
 *                   tip:
 *                     type: number
 *                   items:
 *                     type: array
 *                     items:
 *                       type: object
 *               instructions:
 *                 type: string
 *                 description: User instructions explaining who ordered what
 *                 example: "I and bob had taco each and alice had cake. She and bob also got coke and I got water"
 *               participants:
 *                 type: array
 *                 description: List of participants with their ENS names and amounts paid
 *                 items:
 *                   type: object
 *                   properties:
 *                     ens:
 *                       type: string
 *                     paid:
 *                       type: number
 *                 example: [{"ens": "carol.eth", "paid": 0}, {"ens": "bob.eth", "paid": 0}, {"ens": "alice.eth", "paid": 0}]
 *               priorPlan:
 *                 type: object
 *                 description: Optional previous split plan for iterative corrections
 *     responses:
 *       200:
 *         description: Expense split calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 split:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: string
 *                     currency:
 *                       type: string
 *                     total:
 *                       type: number
 *                     payer:
 *                       type: string
 *                     participants:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           ens:
 *                             type: string
 *                           paid:
 *                             type: number
 *                           owes:
 *                             type: number
 *                           comment:
 *                             type: string
 *                     openQuestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                 metadata:
 *                   type: object
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const splitExpense = async (req: Request, res: Response) => {
  try {
    const { receipt, instructions, participants, priorPlan } = req.body;

    if (!receipt || typeof receipt !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'receipt is required and must be an object' 
      });
    }

    if (!instructions || typeof instructions !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'instructions is required and must be a string' 
      });
    }

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'participants is required and must be a non-empty array' 
      });
    }

    // TESTING MODE: Set to true to use mock responses without spending credits
    const USE_MOCK_TESTING = false;
    
    if (USE_MOCK_TESTING) {
      console.log("Using MOCK testing mode for splitExpense");
      // Simulate network delay (1.5-4 seconds for reasoning)
      const delay = Math.floor(Math.random() * 2500) + 1500;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Randomly succeed (75%) or fail (25%)
      const shouldSucceed = Math.random() > 0.25;
      
      if (shouldSucceed) {
        console.log(`[MOCK] Split expense succeeded after ${delay}ms`);
        
        const total = receipt.total || 0;
        const numParticipants = participants.length;
        const splitAmount = numParticipants > 0 ? (total / numParticipants).toFixed(2) : '0.00';
        
        return res.status(200).json({
          success: true,
          split: {
            summary: `Mock AI split: Each person owes $${splitAmount}`,
            currency: receipt.currency || 'USD',
            total: receipt.total,
            payer: participants[0]?.ens || 'unknown',
            participants: participants.map(p => ({
              ens: p.ens,
              paid: p.paid || 0,
              owes: parseFloat(splitAmount),
              comment: `Equal split based on ${numParticipants} participants`
            })),
            openQuestions: [
              'This is a mock response. Set USE_MOCK_TESTING=false to use real AI.'
            ]
          },
          metadata: {
            model: 'mock-reasoning-model',
            provider: '0xMOCK',
            isValid: true,
            chatId: `mock-${Date.now()}`
          }
        });
      } else {
        console.log(`[MOCK] Split expense failed after ${delay}ms`);
        return res.status(500).json({
          success: false,
          error: 'Mock error: AI reasoning service temporarily unavailable. Please try again.'
        });
      }
    }

    const { split, metadata } = await brokerService.splitExpense(
      receipt,
      instructions,
      participants,
      priorPlan
    );

    return res.status(200).json({ success: true, split, metadata });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
