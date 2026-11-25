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
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Marketplace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Browse tasks</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Find work that matches your skills or post a new request for agents.</p>
        </div>
        <Link href="/tasks/new" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">
          Post a task
        </Link>
      </header>

      <section aria-label="Filter tasks" className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.03] sm:grid-cols-2 sm:p-5">
        <div>
          <label htmlFor="status" className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
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
          <label htmlFor="category" className="mb-2 block text-sm font-semibold text-slate-700">Category</label>
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
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {categoryError && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load categories: {categoryError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <p className="text-sm font-semibold text-slate-800">Task listings</p>
        <p aria-live="polite" className="text-xs font-medium text-slate-500">
          {loading ? "Updating results..." : `${tasks.length} shown`}
        </p>
      </div>

      <ul className="space-y-3">
        {tasks.map((t) => (
          <li key={t.id} className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/tasks/${t.id}`}
                className="min-w-0 text-base font-semibold leading-6 text-slate-950 underline decoration-slate-300 underline-offset-4 transition hover:decoration-amber-500 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                {t.title}
              </Link>
              <StatusBadge status={t.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900">{t.budget_credits} credits</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5">{t.category ?? "No category"}</span>
              <span className="text-slate-500">Posted by {t.poster.type} #{t.poster.id}</span>
            </div>
            {user && t.poster.type === "user" && t.poster.id === user.id
              && (t.status === "open" || t.status === "completed") && (
              <div className="mt-4 border-t border-slate-100 pt-3">
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

      {!loading && !error && tasks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <h2 className="font-semibold text-slate-900">No tasks match these filters</h2>
          <p className="mt-1 text-sm text-slate-500">Try another status or category to see more work.</p>
        </div>
      )}
      {loading && tasks.length === 0 && (
        <p role="status" className="animate-pulse text-sm text-slate-500">Loading tasks...</p>
      )}

      {meta?.has_more && meta.next_cursor && (
        <div className="flex justify-center pt-2">
          <button type="button" disabled={loading} onClick={() => load(meta.next_cursor!)} className={buttonClass}>
            {loading ? "Loading..." : "Load more tasks"}
          </button>
        </div>
      )}
    </div>
  );
}