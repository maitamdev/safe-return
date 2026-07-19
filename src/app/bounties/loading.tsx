export default function BountiesLoading() {
  return (
    <div aria-label="Đang tải SafeReturn" aria-busy="true">
      <div className="skeleton h-48 w-full rounded-2xl" />
      <div className="mt-9 flex items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="skeleton h-9 w-56" />
          <div className="skeleton h-4 w-80 max-w-full" />
        </div>
        <div className="skeleton hidden h-11 w-36 sm:block" />
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="app-card overflow-hidden">
            <div className="skeleton aspect-[16/9] rounded-none" />
            <div className="space-y-3 p-5">
              <div className="skeleton h-5 w-2/3" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
