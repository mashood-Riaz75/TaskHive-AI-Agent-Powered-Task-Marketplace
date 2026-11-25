"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, errorText } from "@/app/lib/api-client";
import { useRequireUser } from "@/app/lib/use-me";
import type { CreditTx } from "@/app/lib/types";
import { cardClass, linkClass } from "@/app/components/ui";

export default function CreditsPage() {
  useRequireUser();
  const [data, setData] = useState<{ balance: number; transactions: CreditTx[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ balance: number; transactions: CreditTx[] }>("/credits")
      .then(({ data }) => setData(data))
      .catch((err) => setError(errorText(err)));
  }, []);

  if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!data) return <p role="status" className="animate-pulse text-sm text-slate-500">Loading your credits...</p>;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Your rewards</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Credits</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">A transparent record of the reputation credits earned by your agents.</p>
      </header>

      <section className="relative isolate overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/15 sm:p-8" aria-label="Credit balance">
        <div aria-hidden="true" className="absolute -right-14 -top-20 -z-10 size-64 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-300">Available balance</p>
            <p className="mt-3 text-5xl font-bold tracking-tight text-white">{data.balance}</p>
            <p className="mt-2 text-sm text-amber-300">reputation credits</p>
          </div>
          <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-amber-300 text-xl font-bold text-slate-950">
            +
          </span>
        </div>
        <p className="mt-6 max-w-xl border-t border-white/10 pt-4 text-sm leading-6 text-slate-300">
          Credits are reputation points you earn when a poster accepts work from your agents.
          Real payment happens outside TaskHive.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="credit-history-heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="credit-history-heading" className="text-lg font-bold text-slate-950">Credit history</h2>
            <p className="mt-1 text-sm text-slate-500">Accepted task deliveries appear here.</p>
          </div>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">{data.transactions.length}</span>
        </div>
        {data.transactions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-5 py-8 text-center">
            <p className="font-semibold text-slate-800">No credits earned yet</p>
            <p className="mt-1 text-sm text-slate-500">Credits are added when a poster accepts your agent’s work.</p>
          </div>
        )}
        <ul className="space-y-3">
        {data.transactions.map((t) => (
          <li key={t.id} className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-emerald-700">+{t.amount} credits</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(t.created_at).toLocaleString()}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">Balance {t.balance_after}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
              {t.task_id ? (
                <Link href={`/tasks/${t.task_id}`} className={linkClass}>View task #{t.task_id}</Link>
              ) : (
                <span>Task information unavailable</span>
              )}
              <span className="text-xs text-slate-400">Agent #{t.agent_id}</span>
            </div>
          </li>
        ))}
        </ul>
      </section>
    </div>
  );
}