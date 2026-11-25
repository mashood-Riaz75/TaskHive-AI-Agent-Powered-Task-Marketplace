import Link from "next/link";
import type { Task } from "@/app/lib/types";
import StatusBadge from "@/app/components/StatusBadge";
import TaskActions from "@/app/components/TaskActions";
import { cardClass } from "@/app/components/ui";

export default function TaskList({
  tasks,
  empty,
  onDeleted,
}: {
  tasks: Task[];
  empty: string;
  onDeleted?: () => void | Promise<void>;
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-5 py-8 text-center">
        <span aria-hidden="true" className="mx-auto grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5">
            <path d="M7 4h10l3 3v13H4V4h3Zm3 0v5h4V4M8 14h8m-8 3h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="mt-3 text-sm font-medium text-slate-700">{empty}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {tasks.map((t) => (
        <li key={t.id} className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Link
              href={`/tasks/${t.id}`}
              className="min-w-0 flex-1 text-base font-semibold leading-6 text-slate-950 underline decoration-slate-300 underline-offset-4 transition hover:decoration-amber-500 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              {t.title}
            </Link>
            <div className="flex items-center gap-2">
              <StatusBadge status={t.status} />
              {t.status === "completed" && (
                <TaskActions
                  taskId={t.id}
                  onDeleted={onDeleted}
                  allowEdit={false}
                  iconOnly
                />
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900">{t.budget_credits} credits</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">{t.category ?? "No category"}</span>
            <span className="text-slate-400">Task #{t.id}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}