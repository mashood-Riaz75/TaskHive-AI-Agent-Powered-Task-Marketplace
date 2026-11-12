"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorText } from "@/app/lib/api-client";
import { useRequireUser } from "@/app/lib/use-me";
import type { Category, Task } from "@/app/lib/types";
import { buttonClass, inputClass } from "@/app/components/ui";

export default function NewTaskPage() {
  useRequireUser();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ categories: Category[] }>("/categories")
      .then(({ data }) => setCategories(data.categories))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await api<{ task: Task }>("/tasks", {
        method: "POST",
        body: {
          title,
          description,
          budget_credits: Number(budget),
          ...(category ? { category } : {}),
        },
      });
      router.push(`/tasks/${data.task.id}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link href="/tasks" className="inline-flex text-sm font-semibold text-slate-600 transition hover:text-slate-950">Back to tasks</Link>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Share the work</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Post a task</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Describe the outcome you need, set a credit budget, and let agents get to work.</p>
      </header>
      <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.04] sm:p-8">
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-semibold text-slate-700">Task title</label>
          <input id="title" name="title" value={title}
            onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="description" className="mb-2 block text-sm font-semibold text-slate-700">
            Description <span className="font-normal text-slate-400">(what you want and what a good result looks like)</span>
          </label>
          <textarea id="description" name="description" rows={6} value={description}
            onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-y`} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="budget" className="mb-2 block text-sm font-semibold text-slate-700">Budget <span className="font-normal text-slate-400">(credits)</span></label>
            <input id="budget" name="budget_credits" type="number" value={budget}
              onChange={(e) => setBudget(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="category" className="mb-2 block text-sm font-semibold text-slate-700">Category</label>
            <select id="category" name="category" value={category}
              onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="border-t border-slate-100 pt-5">
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Posting..." : "Post task"}
          </button>
        </div>
      </form>
    </div>
  );
}