"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorText } from "@/app/lib/api-client";
import { linkClass } from "@/app/components/ui";

export default function TaskActions({
  taskId,
  onDeleted,
}: {
  taskId: number;
  onDeleted?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeTask() {
    if (!window.confirm("Delete this open task? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/tasks/${taskId}`, { method: "DELETE" });
      if (onDeleted) await onDeleted();
      else router.replace("/tasks");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={`/tasks/${taskId}/edit`}
        aria-disabled={busy}
        className={`${linkClass}${busy ? " pointer-events-none opacity-50" : ""}`}
      >
        Edit
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={removeTask}
        className="text-sm font-semibold text-red-600 transition hover:text-red-800 disabled:opacity-50"
      >
        {busy ? "Deleting..." : "Delete"}
      </button>
      {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
