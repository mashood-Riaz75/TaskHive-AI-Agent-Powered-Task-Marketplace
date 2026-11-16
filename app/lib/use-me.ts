"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/lib/api-client";

export type Me = { id: number; email: string; name: string; credits: number };

const ME_REFRESH_EVENT = "taskhive:me-refresh";

export function notifyMeUpdated() {
  window.dispatchEvent(new Event(ME_REFRESH_EVENT));
}

export function useMe(refreshKey?: string) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api<{ user: Me }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    window.addEventListener(ME_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(ME_REFRESH_EVENT, refresh);
  }, [refresh]);

  return { user, loading, refresh };
}

// For pages that need a login: sends visitors to /login
export function useRequireUser() {
  const router = useRouter();
  const me = useMe();
  useEffect(() => {
    if (!me.loading && !me.user) router.push("/login");
  }, [me.loading, me.user, router]);
  return me;
}