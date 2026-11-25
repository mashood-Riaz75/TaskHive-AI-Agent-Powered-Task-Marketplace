"use client";
import { useEffect, useState } from "react";
import { api, errorText } from "@/app/lib/api-client";
import { notifyMeUpdated } from "@/app/lib/use-me";
import type { Deliverable, Task } from "@/app/lib/types";
import StatusBadge from "@/app/components/StatusBadge";
import { buttonClass, cardClass, inputClass } from "@/app/components/ui";

export default function DeliveriesPanel({ task, onChanged }: { task: Task; onChanged: () => void }) {
  const [items, setItems] = useState<Deliverable[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    api<{ deliverables: Deliverable[] }>(`/tasks/${task.id}/deliverables`)
      .then(({ data }) => {
        if (active) {
          setItems(data.deliverables);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) setError(errorText(err));
      });

    return () => {
      active = false;
    };
  }, [task.id, task.status]);

  async function accept(id: number) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await api<{ credits_awarded: { amount: number } }>(
        `/deliverables/${id}/accept`,
        { method: "POST" }
      );
      setNotice(
        `Accepted. ${data.credits_awarded.amount} credits were awarded to the agent's operator. ` +
          "Please pay them outside TaskHive."
      );
      notifyMeUpdated();
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: number) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api(`/deliverables/${id}/reject`, { method: "POST", body: { feedback } });
      setNotice("Rejected. The agent can fix the work and deliver again.");
      setRejectingId(null);
      setFeedback("");
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" aria-label="Deliveries">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-950">Deliveries</h2>
        {items && <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">{items.length}</span>}
      </div>
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {items === null && !error && <p role="status" className="animate-pulse text-sm text-slate-500">Loading deliveries...</p>}
      {items?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-7 text-center text-sm leading-6 text-slate-600">
          No work delivered yet. An agent must claim this task and deliver through the API.
        </p>
      )}

      {items?.map((d) => (
        <div key={d.id} className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-950">Delivery #{d.id}</p>
              <p className="mt-1 text-xs text-slate-500">
                Agent #{d.agent_id} · {new Date(d.submitted_at).toLocaleString()}
              </p>
            </div>
            <StatusBadge status={d.status} />
          </div>
          <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-100">{d.content}</pre>
          {d.feedback && (
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              <strong>Your feedback:</strong> {d.feedback}
            </p>
          )}

          {d.status === "submitted" && task.status === "delivered" && (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-800">Review this delivery</p>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => accept(d.id)} className={buttonClass}>
                  Accept
                </button>
                <button type="button" disabled={busy}
                  onClick={() => setRejectingId(rejectingId === d.id ? null : d.id)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50">
                  Reject
                </button>
              </div>
              {rejectingId === d.id && (
                <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                  <label htmlFor={`feedback-${d.id}`} className="block text-sm font-semibold text-slate-800">
                    What should the agent fix?
                  </label>
                  <textarea id={`feedback-${d.id}`} rows={3} value={feedback}
                    onChange={(e) => setFeedback(e.target.value)} className={inputClass} />
                  <button type="button" disabled={busy} onClick={() => reject(d.id)} className={buttonClass}>
                    Send rejection
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}