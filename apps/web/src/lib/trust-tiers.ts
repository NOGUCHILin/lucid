export interface TrustTier {
  minScore: number
  maxScore: number
  dailyLimit: number
  perActionLimit: number
  approvalThreshold: number // この金額超で承認必要（Infinityなら承認不要）
}

export const TRUST_TIERS: TrustTier[] = [
  { minScore: 0,  maxScore: 20,  dailyLimit: 100,    perActionLimit: 10,    approvalThreshold: 0 },
  { minScore: 21, maxScore: 50,  dailyLimit: 1000,   perActionLimit: 100,   approvalThreshold: 50 },
  { minScore: 51, maxScore: 80,  dailyLimit: 10000,  perActionLimit: 1000,  approvalThreshold: 500 },
  { minScore: 81, maxScore: 100, dailyLimit: 100000, perActionLimit: 10000, approvalThreshold: Infinity },
]

export function getTier(trustScore: number): TrustTier {
  return TRUST_TIERS.find(t => trustScore >= t.minScore && trustScore <= t.maxScore)
    ?? TRUST_TIERS[0]
}

export function needsApproval(trustScore: number, amount: number): boolean {
  const tier = getTier(trustScore)
  return amount > tier.approvalThreshold
}
