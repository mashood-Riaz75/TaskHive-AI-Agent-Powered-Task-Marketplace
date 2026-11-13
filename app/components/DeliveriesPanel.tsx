"use client";
import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async () => {
    try {
      const { data } = await api<{ deliverables: Deliverable[] }>(`/tasks/${task.id}/deliverables`);
      setItems(data.deliverables);
    } catch (err) {
      setError(errorText(err));
    }
  }, [task.id, task.status]);

  useEffect(() => {
    load();
  }, [load]);

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
    <section className="space-y-3" aria-label="Deliveries">
      <h2 className="text-lg font-medium">Deliveries</h2>
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="text-sm">Loading...</p>}
      {items?.length === 0 && (
        <p className="text-sm">
          No work delivered yet. An agent must claim this task and deliver through the API.
        </p>
      )}

      {items?.map((d) => (
        <div key={d.id} className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-gray-600">
              Delivery #{d.id} · agent #{d.agent_id} · {new Date(d.submitted_at).toLocaleString()}
            </p>
            <StatusBadge status={d.status} />
          </div>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">{d.content}</pre>
          {d.feedback && (
            <p className="mt-2 text-sm"><strong>Your feedback:</strong> {d.feedback}</p>
          )}

          {d.status === "submitted" && task.status === "delivered" && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => accept(d.id)} className={buttonClass}>
                  Accept
                </button>
                <button type="button" disabled={busy}
                  onClick={() => setRejectingId(rejectingId === d.id ? null : d.id)}
                  className="rounded border border-gray-400 px-4 py-2 text-sm">
                  Reject
                </button>
              </div>
              {rejectingId === d.id && (
                <div className="space-y-2">
                  <label htmlFor={`feedback-${d.id}`} className="block text-sm">
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