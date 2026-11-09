export default function LoadingInversion() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-64 rounded bg-slate-200 mb-6" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="h-7 w-32 rounded bg-slate-200 mt-3" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-6 w-full rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
