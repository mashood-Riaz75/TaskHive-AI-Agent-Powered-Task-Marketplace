"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, errorText } from "@/app/lib/api-client";
import { useRequireUser } from "@/app/lib/use-me";
import type { Task } from "@/app/lib/types";
import TaskList from "@/app/components/TaskList";
import { TASK_STATUS_CHANGE_EVENT } from "@/app/lib/task-status-events";

export default function DashboardPage() {
  useRequireUser();
  const [waiting, setWaiting] = useState<Task[] | null>(null);
  const [mine, setMine] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshRequest = useRef(0);

  const refreshTasks = useCallback(async () => {
    const requestId = ++refreshRequest.current;
    try {
      const [w, m] = await Promise.all([
        api<{ tasks: Task[] }>("/tasks?poster=me&status=delivered&limit=50"),
        api<{ tasks: Task[] }>("/tasks?poster=me&limit=50"),
      ]);
      if (requestId !== refreshRequest.current) return;
      setWaiting(w.data.tasks);
      setMine(m.data.tasks);
      setError(null);
    } catch (err) {
      if (requestId === refreshRequest.current) setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    void refreshTasks();
    const handleTaskStatusChange = () => {
      void refreshTasks();
    };
    window.addEventListener(TASK_STATUS_CHANGE_EVENT, handleTaskStatusChange);
    return () => {
      window.removeEventListener(TASK_STATUS_CHANGE_EVENT, handleTaskStatusChange);
      refreshRequest.current += 1;
    };
  }, [refreshTasks]);

  if (!waiting || !mine) {
    if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
    return <p role="status" className="animate-pulse text-sm text-slate-500">Loading your tasks...</p>;
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Your workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">My tasks</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Track posted work and review agent deliveries in one place.</p>
        </div>
        <Link href="/tasks/new" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">
          Post a task
        </Link>
      </header>
      {error && <p role="alert" className="text-red-600">{error}</p>}

      <section className="space-y-3" aria-label="Waiting for your review">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-950">Waiting for your review</h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">{waiting.length}</span>
        </div>
        <TaskList tasks={waiting} empty="Nothing to review right now." />
      </section>

      <section className="space-y-3" aria-label="All my tasks">
        <h2 className="text-lg font-bold text-slate-950">Tasks I posted</h2>
        <TaskList
          tasks={mine}
          empty="You haven't posted any tasks yet. Use Post a task."
          onDeleted={refreshTasks}
        />
      </section>
    </div>
  );
}