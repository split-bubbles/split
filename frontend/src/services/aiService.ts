// AI service abstraction for receipt parsing and expense splitting
// Provides two primary functions: parseReceipt and splitExpense
// Keeps fetch logic isolated from UI components.

export interface ParsedReceiptItem {
  description: string; // name field in sample
  amount: number;      // price field in sample
  quantity?: number;
}

export interface ParsedReceipt {
  rawText?: string;
  items: ParsedReceiptItem[];
  currency?: string | null;
  total?: number;
  subtotal?: number | null;
  tax?: number | null;
  tip?: number | null;
}

// Participant input now expects ENS name (not raw wallet address).
// Optionally keeps original address for local UI reconciliation if provided.
export interface SplitParticipantInput {
  ens: string; // ENS name to send to backend
  address?: string; // optional original wallet address retained for UI mapping
  owes?: number; // optional preset intended owed amount (seed value for model)
  paid?: number; // amount already paid/contributed by this participant toward the total
}

export interface SplitResultAllocation {
  address: string;
  amount: number;
  comment?: string;
}

export interface SplitResult {
  allocations: SplitResultAllocation[];
  selfAmount?: number;
  notes?: string;
  summary?: string;
  currency?: string | null;
  total?: number;
  openQuestions?: string[];
  rawPlan?: any; // original split plan from backend for iterative refinement
}

const BASE_URL = `${import.meta.env.VITE_API_PREFIX}/reciepts`; // backend spelling

// NOTE: All mock logic removed. Service now always hits backend.

// Parse using either imageUrl or base64Image; AI panel will decide which arg to pass.
export async function parseReceipt(source: { base64Image?: string; imageUrl?: string }): Promise<ParsedReceipt> {
  try {
    const res = await fetch(`${BASE_URL}/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(source)
    });
    if (!res.ok) throw new Error(`Parse failed: ${res.status}`);
    const data = await res.json();
    const receipt = data.receipt || data;
    return {
      items: Array.isArray(receipt.items) ? receipt.items.map((it: any) => ({
        description: String(it.name ?? it.description ?? ''),
        amount: Number(it.price ?? it.amount ?? 0)
      })) : [],
      currency: receipt.currency ?? null,
      total: receipt.total !== undefined ? Number(receipt.total) : undefined,
      subtotal: receipt.subtotal ?? null,
      tax: receipt.tax ?? null,
      tip: receipt.tip ?? null
    };
  } catch (e: any) {
    console.error('[aiService] parseReceipt failed', e);
    throw new Error(e?.message || 'Receipt parsing failed');
  }
}

// Request an AI-driven split given parsed receipt items, optional user instructions, and participants.
export async function splitExpense(params: {
  parsed: ParsedReceipt;
  instructions?: string;
  participants: SplitParticipantInput[]; // now contains ENS names
  selfAddress: string;
  selfEns?: string; // optional ENS name of the caller/user
  priorPlan?: any;
}): Promise<SplitResult> {
  const { parsed, instructions, participants, selfAddress, selfEns, priorPlan } = params;
  console.debug('[aiService] splitExpense participants input', participants);

  // Ensure the current user (self) is included as a participant at the beginning.
  // If not already present (by ENS match), prepend with default paid 0 unless provided.
  const selfIdentifier = selfEns || selfAddress || "user"; // prefer ENS, fallback to wallet, then generic
  const hasSelf = participants.some(p => p.ens === selfIdentifier);
  const fullParticipants: SplitParticipantInput[] = hasSelf
    ? participants
    : [{ ens: selfIdentifier, paid: 0, owes: undefined }, ...participants];

  const request_body =  JSON.stringify({
    receipt: {
      currency: parsed.currency ?? null,
      total: parsed.total,
      subtotal: parsed.subtotal,
      tax: parsed.tax,
      tip: parsed.tip,
      items: parsed.items.map(i => ({ name: i.description, price: i.amount }))
    },
    instructions,
    // Participants we send to backend:
    //  ens: identifier
    //  paid: what they actually contributed (cash/card) toward the bill
    //  owes: any preset intended owed amount (optional seed for the model; derived from 'amount')
    participants: fullParticipants.map(p => ({
      ens: p.ens,
      paid: p.paid ?? 0,
      owes: p.owes
    })),
    priorPlan: priorPlan || {}
  });

  console.debug('[aiService] splitExpense request body', request_body);

  try {
    const res = await fetch(`${BASE_URL}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: request_body
    });
    if (!res.ok) throw new Error(`Split failed: ${res.status}`);
    const data = await res.json();
    const split = data.split || data; // unwrap
    const allocations = Array.isArray(split.participants) ? split.participants.map((p: any) => ({
      address: String(p.ens || p.address || ''),
      amount: Number(p.owes ?? p.amount ?? 0),
      comment: p.comment
    })) : [];
    return {
      allocations,
      selfAmount: undefined,
      notes: split.summary || data.notes,
      summary: split.summary,
      currency: split.currency ?? parsed.currency ?? null,
      total: split.total ?? parsed.total,
      openQuestions: split.openQuestions || [],
      rawPlan: split
    };
  } catch (e: any) {
    console.error('[aiService] splitExpense failed', e);
    throw new Error(e?.message || 'Split request failed');
  }
}
