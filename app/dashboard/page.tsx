"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
    if (error) return <p role="alert" className="text-red-600">{error}</p>;
    return <p>Loading...</p>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">My tasks</h1>
      {error && <p role="alert" className="text-red-600">{error}</p>}

      <section className="space-y-3" aria-label="Waiting for your review">
        <h2 className="text-lg font-medium">Waiting for your review ({waiting.length})</h2>
        <TaskList tasks={waiting} empty="Nothing to review right now." />
      </section>

      <section className="space-y-3" aria-label="All my tasks">
        <h2 className="text-lg font-medium">Tasks I posted</h2>
        <TaskList tasks={mine} empty="You haven't posted any tasks yet. Use Post a task." />
      </section>
    </div>
  );
}