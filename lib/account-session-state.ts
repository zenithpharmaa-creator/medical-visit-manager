import type { Session } from "@/lib/account-session";

let activeSession: Session | null = null;

export function setActiveAccountSession(session: Session | null) {
  activeSession = session;
}

export function getActiveAccountSession() {
  return activeSession;
}
