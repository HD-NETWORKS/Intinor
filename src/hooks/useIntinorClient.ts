"use client";

import { useMemo } from "react";
import { createIntinorClient, type IntinorClient } from "@/lib/intinor-client";
import { useCurrentUnit } from "@/lib/units/context";

/** An IntinorClient bound to whichever unit is currently selected (see UnitProvider). */
export function useIntinorClient(): IntinorClient {
  const { base } = useCurrentUnit();
  return useMemo(() => createIntinorClient(base), [base]);
}
