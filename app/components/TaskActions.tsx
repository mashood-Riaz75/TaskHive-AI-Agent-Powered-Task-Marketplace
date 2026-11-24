"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, errorText } from "@/app/lib/api-client";
import { linkClass } from "@/app/components/ui";

export default function TaskActions({
  taskId,
  onDeleted,
  allowEdit = true,
  iconOnly = false,
}: {
  taskId: number;
  onDeleted?: () => void | Promise<void>;
  allowEdit?: boolean;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeTask() {
    setBusy(true);
    setError(null);
    try {
      await api(`/tasks/${taskId}`, { method: "DELETE" });
      toast.success("Task deleted.");
      if (onDeleted) await onDeleted();
      else router.replace("/tasks");
    } catch (err) {
      const message = errorText(err);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (busy) return;
    toast("Delete this task?", {
      description: "This action cannot be undone.",
      action: {
        label: "Delete",
        onClick: () => void removeTask(),
      },
      cancel: { label: "Cancel", onClick: () => undefined },
      duration: 10000,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {allowEdit && (
        <Link
          href={`/tasks/${taskId}/edit`}
          aria-disabled={busy}
          className={`${linkClass}${busy ? " pointer-events-none opacity-50" : ""}`}
        >
          Edit
        </Link>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={confirmDelete}
        aria-label="Delete task"
        title="Delete task"
        className={iconOnly
          ? "inline-flex size-9 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 hover:text-red-800 disabled:opacity-50"
          : "text-sm font-semibold text-red-600 transition hover:text-red-800 disabled:opacity-50"}
      >
        {iconOnly ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5">
            <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
          </svg>
        ) : busy ? "Deleting..." : "Delete"}
      </button>
      {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
