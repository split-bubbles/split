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

export interface SplitParticipantInput {
  address: string;
  amount?: number; // custom amount if provided
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

const BASE_URL = "/reciepts"; // backend spelling
const USE_MOCK = (import.meta as any).env?.VITE_AI_MOCK === 'true';

function mockParsedReceipt(): ParsedReceipt {
  return {
    currency: null,
    total: 36.8,
    subtotal: 32,
    tax: null,
    tip: 4.8,
    items: [
      { description: 'TACOS', amount: 20 },
      { description: 'DIET COKE', amount: 2 },
      { description: 'SMART WATER', amount: 3 },
      { description: 'CAKE', amount: 7 }
    ]
  };
}

function mockSplit(participants: SplitParticipantInput[], selfAddress: string): SplitResult {
  const parsed = mockParsedReceipt();
  const total = parsed.total || 0;
  const count = participants.length + 1;
  const per = count ? total / count : 0;
  return {
    allocations: participants.map(p => ({ address: p.address, amount: per })),
    selfAmount: per,
    notes: `Mock AI split equally for ${participants.length + 1} participants (including ${selfAddress}).`
  };
}

// Parse using either imageUrl or base64Image; AI panel will decide which arg to pass.
export async function parseReceipt(source: { base64Image?: string; imageUrl?: string }): Promise<ParsedReceipt> {
  if (USE_MOCK) {
    console.warn('[aiService] Using mock parsed receipt');
    return mockParsedReceipt();
  }
  try {
    const res = await fetch(`${BASE_URL}/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(source)
    });
    if (!res.ok) throw new Error(`Parse failed: ${res.status}`);
    const data = await res.json();
    const receipt = data.receipt || data; // sample response wraps in receipt
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
  } catch (e) {
    console.warn('[aiService] parseReceipt error, falling back to mock', e);
    return mockParsedReceipt();
  }
}

// Request an AI-driven split given parsed receipt items, optional user instructions, and participants.
export async function splitExpense(params: {
  parsed: ParsedReceipt;
  instructions?: string;
  participants: SplitParticipantInput[];
  selfAddress: string;
  priorPlan?: any;
}): Promise<SplitResult> {
  const { parsed, instructions, participants, selfAddress, priorPlan } = params;
  if (USE_MOCK) {
    console.warn('[aiService] Using mock split');
    return mockSplit(participants, selfAddress);
  }
  try {
    const res = await fetch(`${BASE_URL}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receipt: {
          currency: parsed.currency ?? null,
          total: parsed.total,
          subtotal: parsed.subtotal,
          tax: parsed.tax,
          tip: parsed.tip,
          items: parsed.items.map(i => ({ name: i.description, price: i.amount }))
        },
        instructions,
        participants: participants.map(p => ({ ens: p.address, paid: 0 })),
        priorPlan: priorPlan || {}
      })
    });
    if (!res.ok) throw new Error(`Split failed: ${res.status}`);
    const data = await res.json();
    const split = data.split || data; // unwrap
    const allocations = Array.isArray(split.participants) ? split.participants.map((p: any) => ({
      address: String(p.ens || p.address || ''),
      amount: Number(p.owes || p.amount || 0),
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
  } catch (e) {
    console.warn('[aiService] splitExpense error, falling back to mock', e);
    const mock = mockSplit(participants, selfAddress);
    return { ...mock, summary: mock.notes, currency: parsed.currency ?? null, total: parsed.total, openQuestions: [], rawPlan: mock };
  }
}
