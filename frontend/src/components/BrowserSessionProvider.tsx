"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { restoreBrowserSession } from "@/lib/estate-api";
type SessionState = {
  user: any;
  setUser: (value: any) => void;
  loading: boolean;
};
const SessionContext = createContext<SessionState | null>(null);
export function BrowserSessionProvider({ children }: { children: ReactNode }) {
  const [user, updateUser] = useState<any>(null),
    [loading, setLoading] = useState(true);
  const revision = useRef(0);
  const setUser = useCallback((value: any) => {
    revision.current++;
    updateUser(value);
  }, []);
  useEffect(() => {
    let live = true;
    const restore = () => {
      const run = ++revision.current;
      return restoreBrowserSession()
        .then((value) => {
          if (live && run === revision.current) updateUser(value);
        })
        .catch(() => {
          if (live && run === revision.current) updateUser(null);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    };
    void restore();
    const changed = (event: StorageEvent) => {
      if (event.key === "propiedades:token" || event.key === null)
        void restore();
    };
    window.addEventListener("storage", changed);
    return () => {
      live = false;
      window.removeEventListener("storage", changed);
    };
  }, []);
  return (
    <SessionContext.Provider value={{ user, setUser, loading }}>
      {children}
    </SessionContext.Provider>
  );
}
export function useBrowserSession() {
  const state = useContext(SessionContext);
  if (!state) throw Error("Session provider is missing");
  return state;
}
