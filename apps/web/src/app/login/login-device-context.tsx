"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LoginIntentState } from "@/lib/database.types";

interface LoginDeviceContextValue {
  intent: LoginIntentState | null;
  setIntent: (intent: LoginIntentState) => void;
  clearIntent: () => void;
}

const LoginDeviceContext = createContext<LoginDeviceContextValue | null>(null);

export function LoginDeviceProvider({ children }: { children: ReactNode }) {
  const [intent, setIntentState] = useState<LoginIntentState | null>(null);

  const setIntent = useCallback((nextIntent: LoginIntentState) => {
    setIntentState(nextIntent);
  }, []);

  const clearIntent = useCallback(() => {
    setIntentState(null);
  }, []);

  const value = useMemo(
    () => ({ intent, setIntent, clearIntent }),
    [clearIntent, intent, setIntent]
  );

  return (
    <LoginDeviceContext.Provider value={value}>
      {children}
    </LoginDeviceContext.Provider>
  );
}

export function useLoginDeviceIntent() {
  const context = useContext(LoginDeviceContext);
  if (!context) {
    throw new Error("useLoginDeviceIntent must be used inside LoginDeviceProvider");
  }
  return context;
}
