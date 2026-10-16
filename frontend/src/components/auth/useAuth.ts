"use client";

import { useSyncExternalStore } from "react";
import { login, logout, signup } from "@/lib/api";
import { clearSession, getSession, setSession, subscribe, type Session, type User } from "@/lib/session";

type AuthStatus = "loading" | "authenticated" | "anonymous";

/** `undefined` while prerendering/hydrating, since localStorage only exists in the browser. */
const getServerSnapshot = () => undefined;

async function signIn(email: string, password: string): Promise<User> {
  const session = await login(email, password);
  setSession(session);
  return session.user;
}

async function signUp(email: string, password: string): Promise<User> {
  const session = await signup(email, password);
  setSession(session);
  return session.user;
}

function signOut() {
  // The request reads the token before the session is cleared; failures don't
  // matter, since this browser forgets the token either way.
  logout().catch(() => {});
  clearSession();
}

export function useAuth(): {
  status: AuthStatus;
  user: User | null;
  token: string | null;
  signIn: typeof signIn;
  signUp: typeof signUp;
  signOut: typeof signOut;
} {
  const session = useSyncExternalStore<Session | null | undefined>(subscribe, getSession, getServerSnapshot);
  const status = session === undefined ? "loading" : session ? "authenticated" : "anonymous";
  return { status, user: session?.user ?? null, token: session?.token ?? null, signIn, signUp, signOut };
}
