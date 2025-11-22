#!/usr/bin/env ts-node

import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const OFFICIAL_QWEN_PROVIDER = "0x6D233D2610c32f630ED53E8a7Cbf759568041f8f";
const OFFICIAL_DEEPSEEK_PROVIDER = "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3";
const RPC_URL = "https://evmrpc-testnet.0g.ai";

const REASON_PROMPT = `
You are an expert expense splitting assistant. Given a receipt in JSON and a list of participants with amounts they paid, your task is to fairly split the total expense among all participants.

You must follow these rules:
- Treat the first participant in the list as the primary payer who initially covered the full amount.
- Always split the tips and taxes proportionally based on each participant's share of the subtotal.
- Calculate each participant's share of the subtotal (before tax and tip) based on what they ordered.
- Apply the same percentage of tax and tip to each participant's subtotal share to determine their total owed amount.
- Ensure that the sum of all participants' owed amounts equals the total amount on the receipt.

Iteration/Correction Handling:
- In earlier turn, you may have proudced a split based on initial instructions. When the user provides updated instructions or corrections, you must start from the latest split instead of recalculating from scratch.
- Adjust only the necessary parts of the split based on the new information provided, while keeping other parts unchanged.

Output Format:
Respond in JSON format with the following structure:

{
    "summary": "A brief summary of the expense split",
    "currency": "Currency code (e.g., USD)",
    "total": Total amount on the receipt as a number,
    "payer": "ENS of the primary payer",
    "participants": [
        {
            "ens": "Participant's ENS",
            "paid": Amount they paid as a number,
            "owes": Amount they owe as a number,
            "comment": "Optional comment explaining their share"
        },
        ...
    ],
    "openQuestions": [
        "List any uncertainties or clarifications needed"
    ]
}

Ensure all monetary values are numbers rounded to two decimal places.
`;

const RECEIPT_EXTRACTION_PROMPT = `
You are a receipt OCR and structuring assistant.
Output ONLY JSON matching exactly:
{
  "currency": string | null,
  "total": number | null,
  "subtotal": number | null,
  "tax": number | null,
  "tip": number | null,
  "items": [{ "name": string, "price": number }]
}
No extra keys, no commentary.
Infer missing values if obvious; use null when absent.
`;

const BASE_PARTICIPANTS = [
  { ens: "carol.eth", paid: 0 },
  { ens: "bob.eth", paid: 0 },
  { ens: "alice.eth", paid: 0 }
];

const ITERATION_SCENARIOS = [
  {
    title: "Initial Receipt Understanding",
    includeImage:  "https://makereceipt.com/api/v1/uploads/receipt_692142324b51e.jpg",
    // Same user instructions
    instructions:
      "Hi! I and bob had taco each and alice had cake. She and bob also got coke and I got water"
  },
  {
    title: "Feedback Pass",
    includeImage: null,
    // Now phrased as a correction/update
    instructions:
      "Update the previous plan based on this correction: Sorry, I got coke and alice got water. Keep the same receipt and bill total."
  }
];

interface ParticipantShare {
  ens: string;
  paid: number;
  owes: number;
  comment: string;
}

interface ExpenseSplitPlan {
  summary: string;
  currency: string;
  total: number;
  payer: string;
  participants: ParticipantShare[];
  openQuestions: string[];
}


async function ensureLedger(broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>>, initialAmount = 1.5) {
  try {
    const ledger = await broker.ledger.getLedger();
    const availableBalance = ledger[1];
    const required = ethers.parseEther(initialAmount.toString());

    if (availableBalance < required) {
      console.log(`⚠️  Ledger balance low (${ethers.formatEther(availableBalance)} OG). Depositing ${initialAmount} OG...`);
      await broker.ledger.depositFund(initialAmount);
    }
  } catch (error) {
    console.log("⚠️  No ledger found. Creating one...");
    await broker.ledger.addLedger(initialAmount);
  }
}

async function ensureProviderFunds(broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>>, provider: string) {
  try {
    const transferAmount = ethers.parseEther("1.0");
    await broker.ledger.transferFund(provider, "inference", transferAmount);
    console.log("✅ Transferred 1.0 OG to provider account");
  } catch (error: any) {
    console.log(`ℹ️  Transfer skipped: ${error.message}`);
  }
}

function normalizeHeaders(headers: unknown) {
  const normalized: Record<string, string> = {};
  if (headers && typeof headers === "object") {
    Object.entries(headers as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === "string") {
        normalized[key] = value;
      }
    });
  }
  return normalized;
}

function buildUserContent(instructions: string, parsed_receipt: any) {
  const content: OpenAI.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `${instructions}\nParticipants:${JSON.stringify(BASE_PARTICIPANTS)}`
    }
  ];

    if (parsed_receipt && Object.keys(parsed_receipt).length > 0) {
        content.push({
            type: "text",
            text: `Here is the parsed receipt data: ${JSON.stringify(parsed_receipt)}`
        });
    }

  return content;
}

function buildImageContent(imageUrl: string) {

    const content: OpenAI.ChatCompletionContentPart[] = [
        {
            type: "image_url",
            image_url: {
                url: imageUrl
            }
        }
    ];
    
    return content;
}

async function runIteration(
  vision_openai: OpenAI,
  vision_model: string,
  vision_provider: string,
  reason_openai: OpenAI,
  reason_model: string,
  reason_provider: string,
  broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>>,
  instructions: string,
  includeImage: any,
  iterationIndex: number,
  priorPlan?: ExpenseSplitPlan
) {
  console.log(`\n🌀 Iteration ${iterationIndex + 1}: ${ITERATION_SCENARIOS[iterationIndex].title}`);


 
  const querySeed = `${instructions} participants:${BASE_PARTICIPANTS.map((p) => p.ens).join(",")}`;
  
  const vision_servingHeaders = await broker.inference.getRequestHeaders(vision_provider, querySeed);
  const vision_headers = normalizeHeaders(vision_servingHeaders);


  const parsed_receipt: any = {};

  if (includeImage) {
    // First, extract receipt data using vision model
    const visionMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
            role: "system",
            content: RECEIPT_EXTRACTION_PROMPT
        },
        {
            role: "user",
            content: buildImageContent(includeImage)
        }
    ];
    
    const visionCompletion = await vision_openai.chat.completions.create(
        {
            model: vision_model,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: visionMessages
        },
        { headers: vision_headers }
    );

    const visionContent = visionCompletion.choices[0].message.content || "{}";

    Object.assign(parsed_receipt, JSON.parse(visionContent));
    console.log("📤 Vision Model JSON:", parsed_receipt)

    const isValidVision = await broker.inference.processResponse(vision_provider, visionContent, visionCompletion.id);
    console.log(`🔐 Vision response settlement status: ${isValidVision ? "valid" : "invalid"}`);
 }
  const servingHeaders = await broker.inference.getRequestHeaders(reason_provider, querySeed);
  const headers = normalizeHeaders(servingHeaders);

 const reason_messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
        role: "system",
        content: REASON_PROMPT
    },
    {
        role: "user",
        content: buildUserContent(instructions, parsed_receipt)
    }
];

  // Chat-style memory: provide previous JSON plan as an assistant message
  if (priorPlan) {
    reason_messages.splice(1, 0, {
      role: "assistant",
      content: JSON.stringify(priorPlan)
    });
  }

  const completion = await reason_openai.chat.completions.create(
    {
      model: reason_model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: reason_messages
    },
    { headers }
  );

  const messageContent = completion.choices[0].message.content || "{}";
  const parsed: ExpenseSplitPlan = JSON.parse(messageContent);

  console.log("📤 Model JSON:", JSON.stringify(parsed, null, 2));
  console.log(
    `🧮 Splits: ${parsed.participants
      .map((p) => `${p.ens} owes ${p.owes.toFixed(2)} USDC (paid ${p.paid.toFixed(2)})`)
      .join(", ")}`
  );

  const isValid = await broker.inference.processResponse(reason_provider, messageContent, completion.id);
  console.log(`🔐 Response settlement status: ${isValid ? "valid" : "invalid"}`);

  return parsed;
}


async function runSplitFlowDemo() {
  console.log("🚀 Starting iterative split demo using qwen2.5-vl-72b-instruct");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY missing from environment.");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`🔑 Wallet: ${wallet.address}`);

  const broker = await createZGComputeNetworkBroker(wallet);
  await ensureLedger(broker);

  await broker.inference.acknowledgeProviderSigner(OFFICIAL_QWEN_PROVIDER);
  console.log("✅ Provider acknowledged");

  await ensureProviderFunds(broker, OFFICIAL_QWEN_PROVIDER);

  const qwen = await broker.inference.getServiceMetadata(OFFICIAL_QWEN_PROVIDER);
  console.log(`🌐 Endpoint: ${qwen.endpoint}`);
  console.log(`🧠 Model: ${qwen.model}`);

  const qwen_openai = new OpenAI({ baseURL: qwen.endpoint, apiKey: "" });
  
  const deepseekClient = await broker.inference.getServiceMetadata(OFFICIAL_QWEN_PROVIDER);
  console.log(`🌐 Endpoint: ${deepseekClient.endpoint}`);
  console.log(`🧠 Model: ${deepseekClient.model}`)
  const deepseek_openai = new OpenAI({ baseURL: deepseekClient.endpoint, apiKey: "" });

  const iterations: ExpenseSplitPlan[] = [];
  let priorPlan: ExpenseSplitPlan | undefined;

  for (let i = 0; i < ITERATION_SCENARIOS.length; i += 1) {
    const scenario = ITERATION_SCENARIOS[i];
    const plan = await runIteration(
        qwen_openai, qwen.model, OFFICIAL_QWEN_PROVIDER,
        deepseek_openai, deepseekClient.model, OFFICIAL_DEEPSEEK_PROVIDER,
        broker, scenario.instructions, scenario.includeImage, i,  priorPlan);
    iterations.push(plan);
    priorPlan = plan;
  }

  console.log("\n🏁 Iterative flow complete. Latest split:");
  console.log(JSON.stringify(iterations[iterations.length - 1], null, 2));
}

if (require.main === module) {
  runSplitFlowDemo()
    .then(() => {
      console.log("✨ Split demo finished");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Split demo failed", error);
      process.exit(1);
    });
}

export { runSplitFlowDemo };
