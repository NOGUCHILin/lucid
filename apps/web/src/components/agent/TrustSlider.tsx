'use client'

import { useState } from 'react'
import { getTier } from '@/lib/trust-tiers'

interface TrustSliderProps {
  value: number
  onChange: (value: number) => void
}

export function TrustSlider({ value, onChange }: TrustSliderProps) {
  const [local, setLocal] = useState(value)
  const tier = getTier(local)

  const tierColors = ['bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']
  const tierIndex = local <= 20 ? 0 : local <= 50 ? 1 : local <= 80 ? 2 : 3

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>信頼度</span>
        <span className="font-mono font-medium">{local}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={local}
        onChange={e => setLocal(Number(e.target.value))}
        onMouseUp={() => onChange(local)}
        onTouchEnd={() => onChange(local)}
        className="w-full"
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className={`h-2 w-2 rounded-full ${tierColors[tierIndex]}`} />
        <span>日次上限: ¥{tier.dailyLimit.toLocaleString()}</span>
        <span>・</span>
        <span>承認閾値: {tier.approvalThreshold === Infinity ? 'なし' : `¥${tier.approvalThreshold}`}</span>
      </div>
    </div>
  )
}
