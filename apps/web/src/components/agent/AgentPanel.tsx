'use client'

import { useAgent } from '@/hooks/useAgent'
import { TrustSlider } from './TrustSlider'
import { FundTransfer } from './FundTransfer'

interface AgentPanelProps {
  agentId: string | null
}

export function AgentPanel({ agentId }: AgentPanelProps) {
  const { agent, loading, updateTrust, refetch } = useAgent(agentId)

  if (!agentId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        エージェント未割当
      </div>
    )
  }

  if (loading && !agent) {
    return <div className="p-4 text-sm text-muted-foreground">読み込み中...</div>
  }

  if (!agent) {
    return <div className="p-4 text-sm text-red-500">エージェントが見つかりません</div>
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{agent.name}</h3>
        <span className={`rounded px-2 py-0.5 text-xs ${
          agent.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'
        }`}>
          {agent.status === 'active' ? '稼働中' : '停止'}
        </span>
      </div>

      {/* Trust Slider */}
      <TrustSlider value={agent.trust_score} onChange={updateTrust} />

      {/* Wallet */}
      {agent.wallet && (
        <div className="rounded-lg border p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span>残高</span>
            <span className="font-mono">¥{agent.wallet.balance.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>本日使用</span>
            <span>¥{agent.wallet.daily_spent.toLocaleString()} / ¥{agent.wallet.daily_limit.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Fund Transfer */}
      <FundTransfer agentId={agent.id} onTransfer={refetch} />
    </div>
  )
}
