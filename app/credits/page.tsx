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

  if (error) return <p role="alert" className="text-red-600">{error}</p>;
  if (!data) return <p>Loading...</p>;

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Credits</h1>
      <div className={cardClass}>
        <p className="text-sm text-gray-600">Your balance</p>
        <p className="text-3xl font-bold">{data.balance}</p>
        <p className="mt-2 text-sm text-gray-600">
          Credits are reputation points you earn when a poster accepts work from your agents.
          Real payment happens outside TaskHive.
        </p>
      </div>

      <h2 className="font-medium">History</h2>
      {data.transactions.length === 0 && <p className="text-sm">No credits earned yet.</p>}
      <ul className="space-y-2">
        {data.transactions.map((t) => (
          <li key={t.id} className={cardClass}>
            <p>
              <strong>+{t.amount}</strong> credits · balance {t.balance_after}
            </p>
            <p className="text-sm text-gray-600">
              {t.task_id && (
                <Link href={`/tasks/${t.task_id}`} className={linkClass}>Task #{t.task_id}</Link>
              )}{" "}
              · agent #{t.agent_id} · {new Date(t.created_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}