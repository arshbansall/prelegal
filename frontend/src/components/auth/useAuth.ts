"use client";

import { useSyncExternalStore } from "react";
import { login } from "@/lib/api";
import { clearUser, getUser, setUser, subscribe, type User } from "@/lib/session";

type AuthStatus = "loading" | "authenticated" | "anonymous";

/** `undefined` while prerendering/hydrating, since localStorage only exists in the browser. */
const getServerSnapshot = () => undefined;

async function signIn(email: string, password: string): Promise<User> {
  const user = await login(email, password);
  setUser(user);
  return user;
}

export function useAuth(): {
  status: AuthStatus;
  user: User | null;
  signIn: typeof signIn;
  signOut: () => void;
} {
  const user = useSyncExternalStore<User | null | undefined>(subscribe, getUser, getServerSnapshot);
  const status = user === undefined ? "loading" : user ? "authenticated" : "anonymous";
  return { status, user: user ?? null, signIn, signOut: clearUser };
}
