"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ClientApiError, errorText } from "@/app/lib/api-client";
import { useMe } from "@/app/lib/use-me";
import type { Category, ListMeta, Task } from "@/app/lib/types";
import { TASK_STATUS_CHANGE_EVENT } from "@/app/lib/task-status-events";
import StatusBadge from "@/app/components/StatusBadge";
import TaskActions from "@/app/components/TaskActions";
import { buttonClass, cardClass, inputClass, linkClass } from "@/app/components/ui";

async function fetchTasks(status: string, category: string, cursor?: string) {
  const params = new URLSearchParams({ limit: "5" });
  if (status) params.set("status", status);
  if (category) params.set("category", category);
  if (cursor) params.set("cursor", cursor);
  return api<{ tasks: Task[] }, ListMeta>(`/tasks?${params}`);
}

export default function TasksPage() {
  const router = useRouter();
  const { user } = useMe();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const taskRequest = useRef(0);

  const load = useCallback(
    async (cursor?: string) => {
      const requestId = ++taskRequest.current;
      setLoading(true);
      setError(null);
      try {
        const { data, meta } = await fetchTasks(status, category, cursor);
        if (requestId !== taskRequest.current) return;
        setTasks((prev) => (cursor ? [...prev, ...data.tasks] : data.tasks));
        setMeta(meta ?? null);
      } catch (err) {
        if (requestId !== taskRequest.current) return;
        if (err instanceof ClientApiError && err.status === 401) router.push("/login");
        else setError(errorText(err));
      } finally {
        if (requestId === taskRequest.current) setLoading(false);
      }
    },
    [status, category, router]
  );

  useEffect(() => {
    const handleTaskStatusChange = () => {
      void load();
    };
    window.addEventListener(TASK_STATUS_CHANGE_EVENT, handleTaskStatusChange);
    return () => window.removeEventListener(TASK_STATUS_CHANGE_EVENT, handleTaskStatusChange);
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api<{ categories: Category[] }>("/categories")
      .then(({ data }) => {
        setCategories(data.categories);
        setCategoryError(null);
      })
      .catch((err) => {
        if (err instanceof ClientApiError && err.status === 401) router.push("/login");
        else setCategoryError(errorText(err));
      });
  }, [router]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Link href="/tasks/new" className={linkClass}>Post a task</Link>
      </div>

      <div className="flex gap-3">
        <div>
          <label htmlFor="status" className="mb-1 block text-sm">Status</label>
          <select id="status" value={status} onChange={(e) => {
            setLoading(true);
            setError(null);
            setStatus(e.target.value);
          }} className={inputClass}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="claimed">Claimed</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label htmlFor="category" className="mb-1 block text-sm">Category</label>
          <select id="category" value={category} onChange={(e) => {
            setLoading(true);
            setError(null);
            setCategory(e.target.value);
          }} className={inputClass}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {categoryError && (
        <p role="alert" className="text-sm text-red-600">
          Could not load categories: {categoryError}
        </p>
      )}

      <ul className="space-y-3">
        {tasks.map((t) => (
          <li key={t.id} className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/tasks/${t.id}`} className="font-medium underline">{t.title}</Link>
              <StatusBadge status={t.status} />
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {t.budget_credits} credits · {t.category ?? "No category"} · posted by {t.poster.type} #{t.poster.id}
            </p>
            {user && t.poster.type === "user" && t.poster.id === user.id
              && (t.status === "open" || t.status === "completed") && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <TaskActions
                  taskId={t.id}
                  onDeleted={() => load()}
                  allowEdit={t.status === "open"}
                  iconOnly={t.status === "completed"}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {!loading && !error && tasks.length === 0 && <p className="text-sm">No tasks match these filters.</p>}
      {loading && <p className="text-sm">Loading...</p>}

      {meta?.has_more && meta.next_cursor && (
        <button type="button" disabled={loading} onClick={() => load(meta.next_cursor!)} className={buttonClass}>
          Load more
        </button>
      )}
    </div>
  );
}