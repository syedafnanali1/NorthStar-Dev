"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface TodayTasksContextValue {
  completedIds: Set<string> | null; // null = not yet set by CalendarView
  setCompletedIds: (ids: Set<string>) => void;
}

const TodayTasksContext = createContext<TodayTasksContextValue>({
  completedIds: null,
  setCompletedIds: () => undefined,
});

export function TodayTasksProvider({ children }: { children: React.ReactNode }) {
  const [completedIds, setCompletedIdsState] = useState<Set<string> | null>(null);
  const setCompletedIds = useCallback((ids: Set<string>) => setCompletedIdsState(new Set(ids)), []);
  return (
    <TodayTasksContext.Provider value={{ completedIds, setCompletedIds }}>
      {children}
    </TodayTasksContext.Provider>
  );
}

export function useTodayTasks() {
  return useContext(TodayTasksContext);
}
