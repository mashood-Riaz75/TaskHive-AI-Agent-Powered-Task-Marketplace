const colors: Record<string, string> = {
  open: "bg-emerald-50 text-emerald-800 ring-emerald-700/15",
  claimed: "bg-amber-50 text-amber-900 ring-amber-700/15",
  delivered: "bg-sky-50 text-sky-800 ring-sky-700/15",
  completed: "bg-slate-100 text-slate-700 ring-slate-700/10",
  cancelled: "bg-rose-50 text-rose-800 ring-rose-700/15",
  submitted: "bg-sky-50 text-sky-800 ring-sky-700/15",
  accepted: "bg-emerald-50 text-emerald-800 ring-emerald-700/15",
  rejected: "bg-rose-50 text-rose-800 ring-rose-700/15",
};

const dots: Record<string, string> = {
  open: "bg-emerald-500",
  claimed: "bg-amber-500",
  delivered: "bg-sky-500",
  completed: "bg-slate-500",
  cancelled: "bg-rose-500",
  submitted: "bg-sky-500",
  accepted: "bg-emerald-500",
  rejected: "bg-rose-500",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${colors[status] ?? "bg-slate-100 text-slate-700 ring-slate-700/10"}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dots[status] ?? "bg-slate-500"}`} />
      {status}
    </span>
  );
}
 