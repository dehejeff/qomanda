export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: '#21262D', ...style }}
    />
  )
}

export function OrderCardSkeleton() {
  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: '#21262D', border: '1px solid #30363D' }}>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <Skeleton className="h-1.5 w-full" />
    </div>
  )
}

export function MenuItemSkeleton() {
  return (
    <div className="flex items-stretch gap-3 rounded-xl p-3" style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid #30363D' }}>
      <Skeleton className="w-24 h-24 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2 py-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between items-center pt-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-5 px-6 pt-6">
      <div className="flex flex-col items-center gap-4 py-4">
        <Skeleton className="w-20 h-20 rounded-full" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}
