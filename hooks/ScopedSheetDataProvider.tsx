'use client';

import { ReactNode } from 'react';
import { ScopedSheetDataContext, useScopedSheetDataState } from '@/hooks/useSheetData';

export function ScopedSheetDataProvider({ children }: { children: ReactNode }) {
  const state = useScopedSheetDataState();

  return (
    <ScopedSheetDataContext.Provider value={state}>
      {children}
    </ScopedSheetDataContext.Provider>
  );
}
