import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getRepresentativePassword } from "@/lib/representative-auth";
import { verifyManagerPassword } from "@/lib/manager-auth";
import { useVisitStore } from "@/lib/visit-store";

type Session = { role: "manager" | "representative"; representativeId?: string; impersonatedByManager?: boolean };
type AccountSessionValue = { session: Session | null; loading: boolean; loginManager: (password: string, representativeId?: string) => Promise<boolean>; loginRepresentative: (id: string, password: string) => Promise<boolean>; logout: () => Promise<void> };
const SESSION_KEY = "medical_visit_active_session";
const AccountSessionContext = createContext<AccountSessionValue | null>(null);

export function AccountSessionProvider({ children }: { children: ReactNode }) {
  const { data } = useVisitStore();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { AsyncStorage.getItem(SESSION_KEY).then((value) => { if (value) setSession(JSON.parse(value) as Session); }).finally(() => setLoading(false)); }, []);
  const persist = async (next: Session | null) => { setSession(next); if (next) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next)); else await AsyncStorage.removeItem(SESSION_KEY); };
  const value = useMemo<AccountSessionValue>(() => ({
    session,
    loading,
    loginManager: async (password, representativeId) => { if (!(await verifyManagerPassword(password))) return false; await persist(representativeId ? { role: "representative", representativeId, impersonatedByManager: true } : { role: "manager" }); return true; },
    loginRepresentative: async (id, password) => { const representative = data.representatives.find((item) => item.id === id); const saved = representative ? await getRepresentativePassword(id) : null; if (!representative || !saved || saved !== password) return false; await persist({ role: "representative", representativeId: id }); return true; },
    logout: async () => persist(null),
  }), [data.representatives, loading, session]);
  return <AccountSessionContext.Provider value={value}>{children}</AccountSessionContext.Provider>;
}

export function useAccountSession() { const value = useContext(AccountSessionContext); if (!value) throw new Error("useAccountSession must be used inside AccountSessionProvider"); return value; }

export function SessionGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAccountSession();
  const router = useRouter();
  useEffect(() => { if (session) router.replace("/(tabs)"); }, [router, session]);
  if (loading || session) return null;
  return <>{children}</>;
}
