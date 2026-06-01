"use client";

import { useEffect } from "react";

let readyOwners = 0;

export function useE2EHydrationReady() {
  useEffect(() => {
    readyOwners += 1;
    document.documentElement.dataset.e2eHydrated = "true";

    return () => {
      readyOwners = Math.max(0, readyOwners - 1);
      if (readyOwners === 0) {
        delete document.documentElement.dataset.e2eHydrated;
      }
    };
  }, []);
}
