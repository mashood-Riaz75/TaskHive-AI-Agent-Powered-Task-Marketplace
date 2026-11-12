import Link from "next/link";
import type { Task } from "@/app/lib/types";
import StatusBadge from "@/app/components/StatusBadge";
import { cardClass } from "@/app/components/ui";

export default function TaskList({ tasks, empty }: { tasks: Task[]; empty: string }) {
  if (tasks.length === 0) return <p className="text-sm">{empty}</p>;
  return (
    <ul className="space-y-3">
      {tasks.map((t) => (
        <li key={t.id} className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <Link href={`/tasks/${t.id}`} className="font-medium underline">{t.title}</Link>
            <StatusBadge status={t.status} />
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {t.budget_credits} credits · {t.category ?? "No category"}
          </p>
        </li>
      ))}
    </ul>
  );
}