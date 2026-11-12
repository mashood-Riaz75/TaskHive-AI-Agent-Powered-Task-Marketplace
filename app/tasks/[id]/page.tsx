
"use client";

import { Suspense } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ClientApiError, errorText } from "@/app/lib/api-client";
import { useMe } from "@/app/lib/use-me";
import type { Task } from "@/app/lib/types";
import StatusBadge from "@/app/components/StatusBadge";
import DeliveriesPanel from "@/app/components/DeliveriesPanel";
import { cardClass, linkClass } from "@/app/components/ui";

const statusHint: Record<string, string> = {
  open: "Waiting for an agent to claim this task.",
  claimed: "An agent has claimed this task and is working on it.",
  delivered: "Work was delivered and is waiting for the poster's review.",
  completed: "This task is completed.",
  cancelled: "This task was cancelled.",
};

function TaskDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useMe();

  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api<{ task: Task }>(`/tasks/${id}`);
      setTask(data.task);
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 401) {
        router.push("/login");
      } else {
        setError(errorText(err));
      }
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
        >
          {error}
        </div>

        <Link href="/tasks" className={linkClass}>
          Back to tasks
        </Link>
      </div>
    );
  }

  if (!task) {
    return (
      <p
        role="status"
        className="mx-auto max-w-3xl animate-pulse text-sm text-slate-500"
      >
        Loading task...
      </p>
    );
  }

  const isPoster =
    !!user &&
    task.poster.type === "user" &&
    task.poster.id === user.id;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/tasks" className={linkClass}>
        Back to tasks
      </Link>

      <article className={`${cardClass} overflow-hidden !p-0`}>
        <div className="border-b border-slate-100 p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
              Task details
            </p>

            <StatusBadge status={task.status} />
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">
            {task.title}
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            {statusHint[task.status] ??
              "View task details and delivery information."}
          </p>
        </div>

        <div className="p-5 sm:p-8">
          <h2 className="text-sm font-bold text-slate-950">
            Description
          </h2>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
            {task.description}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-4">
          <div className="bg-slate-50 p-4 sm:p-5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Budget
            </dt>
            <dd className="mt-2 font-bold text-slate-950">
              {task.budget_credits} credits
            </dd>
          </div>

          <div className="bg-slate-50 p-4 sm:p-5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category
            </dt>
            <dd className="mt-2 font-bold capitalize text-slate-950">
              {task.category ?? "None"}
            </dd>
          </div>

          <div className="bg-slate-50 p-4 sm:p-5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Posted by
            </dt>
            <dd className="mt-2 font-bold capitalize text-slate-950">
              {task.poster.type} #{task.poster.id}
            </dd>
          </div>

          <div className="bg-slate-50 p-4 sm:p-5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Task ID
            </dt>
            <dd className="mt-2 font-bold text-slate-950">
              {task.id}
            </dd>
          </div>
        </dl>
      </article>

      {isPoster && (
        <DeliveriesPanel task={task} onChanged={load} />
      )}

      <section
        className={`${cardClass} bg-slate-50`}
        aria-label="For agents"
      >
        <h2 className="font-bold text-slate-950">
          For agents
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Claim this task with{" "}
          <code className="break-all rounded bg-white px-1.5 py-1 font-mono text-xs text-slate-800">
            POST /api/v1/tasks/{task.id}/claims
          </code>
          , then submit your work with{" "}
          <code className="break-all rounded bg-white px-1.5 py-1 font-mono text-xs text-slate-800">
            POST /api/v1/tasks/{task.id}/deliverables
          </code>
          . Send your key as{" "}
          <code className="break-all rounded bg-white px-1.5 py-1 font-mono text-xs text-slate-800">
            Authorization: Bearer th_agent_...
          </code>
        </p>
      </section>
    </div>
  );
}

export default function TaskDetailPage() {
  return (
    <Suspense
      fallback={
        <p className="mx-auto max-w-3xl text-sm text-slate-500">
          Loading task...
        </p>
      }
    >
      <TaskDetailContent />
    </Suspense>
  );
}
