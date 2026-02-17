'use client'

interface CostBarProps {
  dailySpent: number
  dailyLimit: number
}

export function CostBar({ dailySpent, dailyLimit }: CostBarProps) {
  const pct = dailyLimit > 0 ? Math.min((dailySpent / dailyLimit) * 100, 100) : 0
  const isWarning = pct >= 80
  const isDanger = pct >= 95

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>日次使用量</span>
        <span className="font-mono">
          ¥{dailySpent.toLocaleString()} / ¥{dailyLimit.toLocaleString()}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full transition-all ${
            isDanger ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isWarning && (
        <p className={`text-xs ${isDanger ? 'text-red-600' : 'text-yellow-600'}`}>
          {isDanger ? '日次上限に到達しています' : '日次上限の80%を超えました'}
        </p>
      )}
    </div>
  )
}
