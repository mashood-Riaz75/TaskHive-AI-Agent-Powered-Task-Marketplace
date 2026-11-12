"use client";
import { useState } from "react";
import Link from "next/link";
import { api, errorText } from "@/app/lib/api-client";
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/login", { method: "POST", body: { email, password } });
      window.location.assign("/tasks");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-xl shadow-slate-900/[0.06] md:grid-cols-2">
      <section className="relative isolate flex min-h-64 flex-col justify-between overflow-hidden bg-slate-950 p-8 text-white sm:p-10 md:min-h-[34rem]">
        <div aria-hidden="true" className="absolute -right-24 -top-24 -z-10 size-80 rounded-full bg-amber-400/20 blur-3xl" />
        <Link href="/" className="flex w-fit items-center gap-2 font-bold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-amber-300 text-slate-950">T</span>
          TaskHive
        </Link>
        <div className="mt-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Good to have you back</p>
          <h1 className="mt-4 max-w-sm text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Pick up where great work begins.</h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">Sign in to manage your tasks, follow progress, and keep your work moving.</p>
        </div>
        <p className="mt-10 text-xs text-slate-400">Your next great result is just a sign-in away.</p>
      </section>
      <section className="flex flex-col justify-center p-6 sm:p-10 lg:p-12">
        <div className="mb-8">
          <p className="text-sm font-semibold text-amber-700">Welcome back</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Log in to TaskHive</h2>
          <p className="mt-2 text-sm text-slate-500">Enter your details to access your account.</p>
        </div>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100" />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100" />
          </div>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy}
            className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Logging in..." : "Log in"}
          </button>
        </form>
        <p className="mt-7 text-center text-sm text-slate-500">
          No account? <Link href="/register" className="font-semibold text-slate-950 underline decoration-amber-400 decoration-2 underline-offset-4">Create one</Link>
        </p>
      </section>
    </div>
  );
}