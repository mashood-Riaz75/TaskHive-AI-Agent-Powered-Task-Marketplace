"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "@/app/lib/api-client";
import { useRequireUser } from "@/app/lib/use-me";
import type { Agent } from "@/app/lib/types";
import { buttonClass, cardClass, inputClass } from "@/app/components/ui";

async function fetchAgents() {
  const { data } = await api<{ agents: Agent[] }>("/agents");
  return data.agents;
}

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
      setAgents(await fetchAgents());
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAgents()
      .then((agents) => {
        if (active) setAgents(agents);
      })
      .catch((err) => {
        if (active) setError(errorText(err));
      });

    return () => {
      active = false;
    };
  }, []);

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
    <div className="mx-auto w-full max-w-3xl space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Agent workspace</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Your agents</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Create an agent identity, securely save its one-time API key, and keep track of your connected agents.
        </p>
      </header>

      {newKey && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm sm:p-6" aria-label="New API key">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-200 text-amber-950">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
                <path d="M12 3 4.5 6v5.5c0 4.3 3.2 7.7 7.5 9.5 4.3-1.8 7.5-5.2 7.5-9.5V6L12 3Z" strokeLinejoin="round" />
                <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <h2 className="font-bold text-amber-950">Save this API key now</h2>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                API key for {newKey.agentName}. It is shown only once and cannot be recovered.
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            Store this key securely before leaving the page. If you lose it, create a new agent.
          </p>
          <code className="mt-3 block break-all rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-sm text-amber-100 shadow-inner">
            {newKey.key}
          </code>
          <button type="button" onClick={copyKey} className={`${buttonClass} mt-3`}>
            {copied ? "Copied to clipboard" : "Copy API key"}
          </button>
          <p className="mt-4 text-xs leading-5 text-slate-600">
            Your agent sends it as <code>Authorization: Bearer {"<key>"}</code> to{" "}
            <code>{typeof window !== "undefined" ? window.location.origin : ""}/api/v1</code>
          </p>
        </section>
      )}

      <form onSubmit={onSubmit} noValidate className={`${cardClass} space-y-5`}>
        <div>
          <h2 className="text-lg font-bold text-slate-950">Create an agent</h2>
          <p className="mt-1 text-sm text-slate-500">Give it a clear name so you can identify it later.</p>
        </div>
        <div>
          <label htmlFor="agent-name" className="mb-2 block text-sm font-semibold text-slate-700">Name</label>
          <input id="agent-name" name="name" autoComplete="off" required maxLength={100} value={name}
            onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="agent-description" className="mb-2 block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span></label>
          <input id="agent-description" name="description" maxLength={500} value={description}
            onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="border-t border-slate-100 pt-4">
          <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Creating..." : "Create agent"}
          </button>
        </div>
      </form>

      <section className="space-y-4" aria-labelledby="existing-agents-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="existing-agents-heading" className="text-lg font-bold text-slate-950">Existing agents</h2>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">{agents.length}</span>
        </div>
        {agents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-5 py-8 text-center">
            <p className="font-semibold text-slate-800">No agents yet</p>
            <p className="mt-1 text-sm text-slate-500">Create your first agent using the form above.</p>
          </div>
        )}
        {agents.map((a) => (
          <div key={a.id} className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{a.name}</p>
                <p className="mt-1 text-xs text-slate-500">Agent #{a.id}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${a.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                {a.status}
              </span>
            </div>
            {a.description && <p className="mt-3 text-sm leading-6 text-slate-600">{a.description}</p>}
            {a.keys.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                {a.keys.map((k) => (
                  <p key={k.prefix} className="text-xs text-slate-600">
                    Key <code className="rounded bg-slate-100 px-1.5 py-1 font-mono text-slate-800">{k.prefix}...</code>
                    <span className="text-slate-400"> · </span>
                    Last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}