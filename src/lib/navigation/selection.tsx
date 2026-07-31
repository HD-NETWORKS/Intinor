"use client";

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

export type PipeResource = "network_input" | "video_input" | "video_mixer" | "encoder";

export const PIPE_RESOURCE_PATH: Record<PipeResource, string> = {
  network_input: "/inputs",
  video_input: "/netvideo",
  video_mixer: "/mixer",
  encoder: "/encoders",
};

interface PendingSelection {
  resource: PipeResource;
  index: number;
}

interface SelectionContextValue {
  /** Record which item the user clicked, then navigate — the destination page consumes it. */
  setPending: (resource: PipeResource, index: number) => void;
  /** Read-and-clear: only returns a value the first time the matching page checks after a click-through. */
  consumePending: (resource: PipeResource) => number | null;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

/**
 * Hands an index off across a route navigation without a URL param: a tile
 * click stores `{ resource, index }` in a ref, then the destination page
 * (inputs/netvideo/mixer/encoders) consumes it once on load to pick that item
 * instead of defaulting to the first one. A ref (not state) is enough since
 * nothing needs to re-render while the value is in flight.
 */
export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const pendingRef = useRef<PendingSelection | null>(null);

  const setPending = useCallback((resource: PipeResource, index: number) => {
    pendingRef.current = { resource, index };
  }, []);

  const consumePending = useCallback((resource: PipeResource) => {
    if (pendingRef.current && pendingRef.current.resource === resource) {
      const idx = pendingRef.current.index;
      pendingRef.current = null;
      return idx;
    }
    return null;
  }, []);

  const value = useMemo(() => ({ setPending, consumePending }), [setPending, consumePending]);

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelectionHandoff(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelectionHandoff must be used within <SelectionProvider>");
  return ctx;
}

/** Click handler for a card/tile/row that should jump straight to one item's settings page. */
export function useOpenPipeSettings(resource: PipeResource, index: number): () => void {
  const router = useRouter();
  const { setPending } = useSelectionHandoff();
  return useCallback(() => {
    setPending(resource, index);
    router.push(PIPE_RESOURCE_PATH[resource]);
  }, [resource, index, setPending, router]);
}
