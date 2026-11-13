"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ClientApiError, errorText } from "@/app/lib/api-client";
import { useMe } from "@/app/lib/use-me";
import type { Category, Task } from "@/app/lib/types";
import { buttonClass, inputClass, linkClass } from "@/app/components/ui";

function EditTaskContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: userLoading } = useMe();
  const [task, setTask] = useState<Task | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ task: Task }>(`/tasks/${id}`)
      .then(({ data }) => {
        setTask(data.task);
        setTitle(data.task.title);
        setDescription(data.task.description);
        setBudget(String(data.task.budget_credits));
        setCategory(data.task.category ?? "");
      })
      .catch((err) => {
        if (err instanceof ClientApiError && err.status === 401) router.push("/login");
        else setError(errorText(err));
      });
    api<{ categories: Category[] }>("/categories")
      .then(({ data }) => setCategories(data.categories))
      .catch(() => {});
  }, [id, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/tasks/${id}`, {
        method: "PATCH",
        body: {
          title,
          description,
          budget_credits: Number(budget),
          ...(category ? { category } : {}),
        },
      });
      router.push(`/tasks/${id}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (userLoading || (!task && !error)) return <p role="status">Loading task...</p>;
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!task || !user || task.poster.type !== "user" || task.poster.id !== user.id) {
    return <p role="alert" className="text-sm text-red-600">Only the task poster can edit this task.</p>;
  }
  if (task.status !== "open") {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-slate-600">Only open tasks can be edited.</p>
        <Link href={`/tasks/${id}`} className={linkClass}>Back to task</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link href={`/tasks/${id}`} className={linkClass}>Back to task</Link>
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Edit task</h1>
        <p className="mt-2 text-sm text-slate-500">Only open tasks can be edited.</p>
      </header>
      <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-8">
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-semibold text-slate-700">Task title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="description" className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
          <textarea id="description" rows={6} value={description}
            onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-y`} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="budget" className="mb-2 block text-sm font-semibold text-slate-700">Budget (credits)</label>
            <input id="budget" type="number" value={budget}
              onChange={(e) => setBudget(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="category" className="mb-2 block text-sm font-semibold text-slate-700">Category</label>
            <select id="category" value={category}
              onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              <option value="">No category</option>
              {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </select>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}

export default function EditTaskPage() {
  return (
    <Suspense fallback={<p role="status">Loading task...</p>}>
      <EditTaskContent />
    </Suspense>
  );
}
