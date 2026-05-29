import React, { createContext, useContext, useMemo, useState } from 'react';
import type { HandleMemberPlacement } from '../../utils/handleDefaults';

export type HandleDragMeasure = { mmFromTop: number; mmFromBottom: number };

type Ctx = {
  placement: HandleMemberPlacement | null;
  setPlacement: (p: HandleMemberPlacement | null) => void;
  dragMeasure: HandleDragMeasure | null;
  setDragMeasure: (m: HandleDragMeasure | null) => void;
};

const HomeownerHandlePlacementContext = createContext<Ctx | null>(null);

export function HomeownerHandlePlacementProvider({ children }: { children: React.ReactNode }) {
  const [placement, setPlacement] = useState<HandleMemberPlacement | null>(null);
  const [dragMeasure, setDragMeasure] = useState<HandleDragMeasure | null>(null);
  const value = useMemo(
    () => ({ placement, setPlacement, dragMeasure, setDragMeasure }),
    [placement, dragMeasure],
  );
  return (
    <HomeownerHandlePlacementContext.Provider value={value}>{children}</HomeownerHandlePlacementContext.Provider>
  );
}

export function useHomeownerHandlePlacement(): Ctx {
  const ctx = useContext(HomeownerHandlePlacementContext);
  if (!ctx) {
    return {
      placement: null,
      setPlacement: () => {},
      dragMeasure: null,
      setDragMeasure: () => {},
    };
  }
  return ctx;
}
