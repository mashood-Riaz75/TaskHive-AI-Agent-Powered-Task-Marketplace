
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/app/lib/api-client";
import { useMe } from "@/app/lib/use-me";

function HeaderContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useMe(pathname);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <nav
        aria-label="Main"
        className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-5 px-4 text-sm sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-bold tracking-tight text-slate-950"
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-xl bg-amber-300 text-sm text-slate-950"
          >
            T
          </span>
          TaskHive
        </Link>

        {user && (
          <>
            <Link
              href="/tasks"
              className="rounded-full bg-amber-300 px-4 py-2 font-semibold text-slate-950 transition hover:bg-amber-200"
            >
              Browse tasks
            </Link>

            <Link
              href="/tasks/new"
              className="font-medium text-slate-600 transition hover:text-slate-950"
            >
              Post a task
            </Link>
          </>
        )}

        <span className="flex-1" />

        {loading ? null : user ? (
          <>
            <span className="hidden text-slate-600 sm:inline">
              {user.name} <span className="text-slate-300">·</span>{" "}
              {user.credits} credits
            </span>

            <button
              type="button"
              onClick={logout}
              className="font-medium text-slate-600 transition hover:text-slate-950"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-full bg-amber-300 px-4 py-2 font-semibold text-slate-950 transition hover:bg-amber-200"
            >
              Log in
            </Link>

            <Link
              href="/register"
              className="rounded-full bg-slate-950 px-4 py-2 font-semibold text-white transition hover:bg-slate-700"
            >
              Get started
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

export default function Header() {
  return (
    <Suspense
      fallback={
        <header className="min-h-16 border-b border-slate-200" />
      }
    >
      <HeaderContent />
    </Suspense>
  );
}
