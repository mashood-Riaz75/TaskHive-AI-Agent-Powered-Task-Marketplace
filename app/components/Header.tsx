
"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { api, errorText } from "@/app/lib/api-client";
import { useMe } from "@/app/lib/use-me";

function HeaderContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useMe(pathname);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profilePanelRef = useRef<HTMLElement>(null);
  const profileCloseButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeProfile = useCallback(() => {
    setProfileOpen(false);
    profileButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!profileOpen) return;

    profileCloseButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeProfile();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = profilePanelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      const items = Array.from(focusable ?? []);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (!profilePanelRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeProfile, profileOpen]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api("/auth/logout", { method: "POST" });
      toast.success("You have been logged out.");
      setProfileOpen(false);
      router.push("/login");
    } catch (err) {
      toast.error(errorText(err));
      setLoggingOut(false);
    }
  }

  function confirmLogout() {
    if (loggingOut) return;
    toast("Log out of TaskHive?", {
      action: {
        label: "Log out",
        onClick: () => void logout(),
      },
      cancel: { label: "Cancel", onClick: () => undefined },
      duration: 10000,
    });
  }

  const profileOverlay =
    user && mounted
      ? createPortal(
          <div
            aria-hidden={!profileOpen}
            className={`fixed inset-0 z-50 ${
              profileOpen ? "pointer-events-auto" : "pointer-events-none"
            }`}
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label="Close profile panel"
              onClick={closeProfile}
              className={`absolute inset-0 size-full bg-transparent transition-[opacity,backdrop-filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                profileOpen ? "opacity-100 backdrop-blur-md" : "opacity-0 backdrop-blur-0"
              }`}
            />
            <aside
              ref={profilePanelRef}
              id="profile-panel"
              role="dialog"
              aria-modal={profileOpen}
              aria-labelledby="profile-panel-title"
              inert={!profileOpen}
              className={`absolute inset-y-0 right-0 z-10 flex w-full max-w-md transform flex-col bg-slate-950 text-white shadow-2xl shadow-slate-950/40 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                profileOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                    Account
                  </p>
                  <h2 id="profile-panel-title" className="mt-1 text-lg font-semibold text-white">
                    Your profile
                  </h2>
                </div>
                <button
                  ref={profileCloseButtonRef}
                  type="button"
                  onClick={closeProfile}
                  aria-label="Close profile panel"
                  className="grid size-9 place-items-center rounded-full text-slate-300 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="size-5"
                  >
                    <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6 p-6">
                <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-lg shadow-black/20">
                  <div className="flex items-center gap-4">
                    <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-amber-300 text-xl font-bold text-slate-950 shadow-lg shadow-amber-950/20">
                      {user.name.trim().charAt(0).toUpperCase() || "U"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{user.name}</p>
                      <p className="truncate text-sm text-slate-300">{user.email}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-slate-400">
                    Your TaskHive account details and marketplace balance.
                  </p>
                </section>

                <dl className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
                  <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3.5">
                    <dt className="text-sm text-slate-400">Name</dt>
                    <dd className="truncate text-right text-sm font-medium text-slate-100">
                      {user.name}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3.5">
                    <dt className="text-sm text-slate-400">Email</dt>
                    <dd className="truncate text-right text-sm font-medium text-slate-100">
                      {user.email}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <dt className="text-sm text-slate-400">Credits</dt>
                    <dd className="text-right text-sm font-semibold text-amber-300">
                      {user.credits}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-auto border-t border-black/10 p-6">
                <button
                  type="button"
                  onClick={confirmLogout}
                  disabled={loggingOut}
                  className="w-full rounded-xl border border-red-900 bg-red-950 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-800 hover:bg-red-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loggingOut ? "Logging out..." : "Log out"}
                </button>
              </div>
            </aside>
          </div>,
          document.body
        )
      : null;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 text-white shadow-lg shadow-slate-950/10 backdrop-blur-xl">
      <nav
        aria-label="Main"
        className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-2 px-4 text-sm sm:gap-5 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-bold tracking-tight text-white"
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
              aria-label="Browse tasks"
              className="flex size-10 shrink-0 items-center justify-center gap-2 rounded-full bg-amber-300 px-3 py-2 font-semibold text-slate-950 transition hover:bg-amber-200 sm:size-auto sm:px-4"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                <path d="M4 6.5h16M4 12h16M4 17.5h16" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">Browse tasks</span>
            </Link>

            <Link
              href="/tasks/new"
              aria-label="Post a task"
              className="flex size-10 shrink-0 items-center justify-center gap-2 rounded-full border border-slate-700 text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white sm:w-auto sm:px-4"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">Post a task</span>
            </Link>
          </>
        )}

        <span className="flex-1" />

        {loading ? null : user ? (
          <button
            ref={profileButtonRef}
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            aria-label={profileOpen ? "Close profile panel" : "Open profile panel"}
            aria-expanded={profileOpen}
            aria-controls="profile-panel"
            className={`grid size-10 place-items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 ${
              profileOpen
                  ? "border-amber-300 bg-slate-800 text-amber-300"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:border-amber-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="size-5"
            >
              <circle cx="12" cy="8" r="3.25" />
              <path d="M5.5 20a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-full border border-amber-300/30 bg-amber-300 px-4 py-2 font-semibold text-slate-950 transition hover:bg-amber-200"
            >
              Log in
            </Link>

            <Link
              href="/register"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20"
            >
              Get started
            </Link>
          </>
        )}
      </nav>
      {profileOverlay}
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
