function SkeletonCard() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3" aria-hidden="true">
      <div className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] items-center gap-[14px]">
        <div className="h-12 w-12 shrink-0 rounded-[14px] bg-gradient-to-br from-[#ffd3ea] via-[#ffc0e1] to-[#ffb0d8] animate-pulse" />
        <div className="grid min-w-0 gap-[6px]">
          <div className="h-4 w-[92px] rounded-full bg-[#f0f0f0] animate-pulse" />
          <div className="h-[11px] w-[128px] rounded-full bg-[#f3f3f3] animate-pulse" />
          <div className="h-[11px] w-[92px] rounded-full bg-[#f3f3f3] animate-pulse" />
        </div>
      </div>
      <div className="h-[36px] w-[88px] rounded-full bg-[#efefef] animate-pulse" />
    </div>
  );
}

export function LoadingSection() {
  return (
    <div className="grid gap-[18px]" aria-hidden="true">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
