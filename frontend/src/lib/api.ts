export type MintPayload = {
  project_id: string;
  project_type: string;
  tonnes: number;
  vintage_year: number;
  owner_id: string;
  developer_id?: string;
  regulator_id?: string;
  // Optional — omit to let backend auto-compute
  r_ratio?: number;
  m_flag?: number;
  t_flag?: number;
};

export type ComputedFeatures = {
  R_ratio: number;
  Vintage_Age: number;
  M_flag: number;
  T_flag: number;
};

export type TransferPayload = {
  credit_id: string;
  from_owner: string;
  to_owner: string;
  units: number;
};

export type RetirePayload = {
  credit_id: string;
  owner_id: string;
};

export type MintResponse = {
  credit_id: string;
  ai_risk_score: number;
  computed_features: ComputedFeatures;
  owner_id: string;
  tonnes: number;
  block_index: number;
  block_hash: string;
  status: string;
};

export type CreditResponse = {
  credit_id: string;
  details: {
    tonnes: number;
    project_type: string;
    vintage_year: number;
    ai_risk_score: number;
    status: string;
  };
  ownership: Record<string, number>;
};

export type CreditHistoryResponse = {
  credit_id: string;
  history: Array<Record<string, unknown>>;
};

export type ChainStatsResponse = {
  total_credits: number;
  active_credits: number;
  retired_credits: number;
  flagged_high_risk: number;
  total_transactions: number;
  chain_length: number;
};

export type ChainResponse = {
  length: number;
  chain: Array<{
    index: number;
    hash: string;
    previous_hash: string;
    tx_count: number;
    timestamp: number;
  }>;
};

export type ChainValidationResponse = {
  chain_length: number;
  is_valid: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const fallback = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      throw new Error(data?.detail ?? data?.error ?? fallback);
    } catch {
      throw new Error(fallback);
    }
  }

  return (await res.json()) as T;
}

export function issueCredit(payload: MintPayload) {
  return apiRequest<MintResponse>("/credits/issue", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function transferCredit(payload: TransferPayload) {
  return apiRequest<{ status: string }>("/credits/transfer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function retireCredit(payload: RetirePayload) {
  return apiRequest<{ status: string }>("/credits/retire", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchCredit(creditId: string) {
  return apiRequest<CreditResponse>(`/credits/${encodeURIComponent(creditId)}`);
}

export function fetchCreditHistory(creditId: string) {
  return apiRequest<CreditHistoryResponse>(`/credits/${encodeURIComponent(creditId)}/history`);
}

export function fetchChainStats() {
  return apiRequest<ChainStatsResponse>("/chain/stats");
}

export function fetchChain() {
  return apiRequest<ChainResponse>("/chain");
}

export function fetchChainValidation() {
  return apiRequest<ChainValidationResponse>("/chain/validate");
}
