// AI service abstraction for receipt parsing and expense splitting
// Provides two primary functions: parseReceipt and splitExpense
// Keeps fetch logic isolated from UI components.

export interface ParsedReceiptItem {
  description: string;
  amount: number;
  quantity?: number;
}

export interface ParsedReceipt {
  rawText?: string;
  items: ParsedReceiptItem[];
  currency?: string;
  total?: number;
}

export interface SplitParticipantInput {
  address: string;
  amount?: number; // custom amount if provided
}

export interface SplitResultAllocation {
  address: string;
  amount: number;
}

export interface SplitResult {
  allocations: SplitResultAllocation[];
  selfAmount?: number;
  notes?: string;
}

const BASE_URL = "/reciepts"; // note: backend path uses this spelling in existing code

// Parse a receipt image (base64 string or URL). Returns structured items.
export async function parseReceipt(imageData: string): Promise<ParsedReceipt> {
  const res = await fetch(`${BASE_URL}/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageData })
  });
  if (!res.ok) throw new Error(`Parse failed: ${res.status}`);
  const data = await res.json();
  // Expect backend to return { items: [...], rawText, currency, total }
  return {
    items: Array.isArray(data.items) ? data.items.map((it: any) => ({
      description: String(it.description ?? it.name ?? ""),
      amount: Number(it.amount ?? it.price ?? 0),
      quantity: it.quantity !== undefined ? Number(it.quantity) : undefined
    })) : [],
    rawText: data.rawText,
    currency: data.currency,
    total: data.total !== undefined ? Number(data.total) : undefined
  };
}

// Request an AI-driven split given parsed receipt items, optional user instructions, and participants.
export async function splitExpense(params: {
  parsed: ParsedReceipt;
  instructions?: string;
  participants: SplitParticipantInput[];
  selfAddress: string;
}): Promise<SplitResult> {
  const { parsed, instructions, participants, selfAddress } = params;
  const res = await fetch(`${BASE_URL}/split`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: parsed.items,
      total: parsed.total,
      currency: parsed.currency,
      instructions,
      participants,
      selfAddress
    })
  });
  if (!res.ok) throw new Error(`Split failed: ${res.status}`);
  const data = await res.json();
  // Expect backend to return { allocations: [{address, amount}], selfAmount, notes }
  return {
    allocations: Array.isArray(data.allocations) ? data.allocations.map((a: any) => ({
      address: String(a.address),
      amount: Number(a.amount)
    })) : [],
    selfAmount: data.selfAmount !== undefined ? Number(data.selfAmount) : undefined,
    notes: data.notes
  };
}
