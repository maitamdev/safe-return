export default function RootLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-24 sm:px-6 lg:px-8" aria-label="Đang tải" aria-busy="true">
      <div className="skeleton h-10 w-48" />
      <div className="mt-4 skeleton h-5 w-full max-w-xl" />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="app-card space-y-3 p-5">
            <div className="skeleton h-32 w-full" />
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
