"use client";
import { useEffect, useState } from "react";
import { api, errorText } from "@/app/lib/api-client";
import { useRequireUser } from "@/app/lib/use-me";
import type { Task } from "@/app/lib/types";
import TaskList from "@/app/components/TaskList";

export default function DashboardPage() {
  useRequireUser();
  const [waiting, setWaiting] = useState<Task[] | null>(null);
  const [mine, setMine] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<{ tasks: Task[] }>("/tasks?poster=me&status=delivered&limit=50"),
      api<{ tasks: Task[] }>("/tasks?poster=me&limit=50"),
    ])
      .then(([w, m]) => {
        setWaiting(w.data.tasks);
        setMine(m.data.tasks);
      })
      .catch((err) => setError(errorText(err)));
  }, []);

  if (error) return <p role="alert" className="text-red-600">{error}</p>;
  if (!waiting || !mine) return <p>Loading...</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">My tasks</h1>

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