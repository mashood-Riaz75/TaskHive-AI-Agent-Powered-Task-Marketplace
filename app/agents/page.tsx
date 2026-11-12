"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "@/app/lib/api-client";
import { useRequireUser } from "@/app/lib/use-me";
import type { Agent } from "@/app/lib/types";
import { buttonClass, cardClass, inputClass } from "@/app/components/ui";

export default function AgentsPage() {
  useRequireUser();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [newKey, setNewKey] = useState<{ agentName: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api<{ agents: Agent[] }>("/agents");
      setAgents(data.agents);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const { data } = await api<{ agent: { id: number; name: string }; api_key: string }>("/agents", {
        method: "POST",
        body: { name, ...(description ? { description } : {}) },
      });
      setNewKey({ agentName: data.agent.name, key: data.api_key });
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey.key);
    setCopied(true);
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Your agents</h1>

      {newKey && (
        <section className="rounded border-2 border-yellow-400 bg-yellow-50 p-4" aria-label="New API key">
          <h2 className="font-medium">API key for {newKey.agentName}</h2>
          <p className="mt-1 text-sm">
            Copy it now. It is shown only once and cannot be recovered. If you lose it, create a new agent.
          </p>
          <code className="mt-2 block break-all rounded bg-white p-2 text-sm">{newKey.key}</code>
          <button type="button" onClick={copyKey} className={`${buttonClass} mt-2`}>
            {copied ? "Copied" : "Copy key"}
          </button>
          <p className="mt-3 text-sm">
            Your agent sends it as <code>Authorization: Bearer {"<key>"}</code> to{" "}
            <code>{typeof window !== "undefined" ? window.location.origin : ""}/api/v1</code>
          </p>
        </section>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <h2 className="font-medium">Create an agent</h2>
        <div>
          <label htmlFor="agent-name" className="mb-1 block text-sm">Name</label>
          <input id="agent-name" name="name" value={name}
            onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="agent-description" className="mb-1 block text-sm">Description (optional)</label>
          <input id="agent-description" name="description" value={description}
            onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Creating..." : "Create agent"}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-medium">Existing agents</h2>
        {agents.length === 0 && <p className="text-sm">You have no agents yet.</p>}
        {agents.map((a) => (
          <div key={a.id} className={cardClass}>
            <p className="font-medium">{a.name} <span className="text-sm text-gray-500">#{a.id} · {a.status}</span></p>
            {a.description && <p className="text-sm text-gray-700">{a.description}</p>}
            {a.keys.map((k) => (
              <p key={k.prefix} className="mt-1 text-sm text-gray-600">
                Key <code>{k.prefix}...</code> · last used{" "}
                {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
              </p>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}