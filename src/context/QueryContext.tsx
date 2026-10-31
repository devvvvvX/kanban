import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useProject } from "./ProjectContext";
import { useTickets } from "./TicketContext";
import {
  QueryEngine,
  type QueryFilterGroup,
  type FilterCondition,
  type QuerySortOption,
  type EnrichedTicketRecord,
} from "../lib/query/queryEngine";
import {
  SavedQueryService,
  type SavedQueryRecord,
} from "../lib/query/savedQueryService";
import { getDb } from "../lib/db/connection";

export interface QueryContextType {
  activeFilter: QueryFilterGroup;
  activeSort: QuerySortOption;
  queryResults: EnrichedTicketRecord[];
  totalCount: number;
  executionTimeMs: number;
  isQueryRunning: boolean;
  savedQueries: SavedQueryRecord[];
  activeSavedQueryId: string | null;
  isSaveModalOpen: boolean;

  addCondition: (condition: FilterCondition) => void;
  updateCondition: (index: number, condition: FilterCondition) => void;
  removeCondition: (index: number) => void;
  clearConditions: () => void;
  setOperator: (op: "AND" | "OR") => void;
  setSort: (sort: QuerySortOption) => void;
  runQuery: () => void;
  loadSavedQuery: (savedQuery: SavedQueryRecord) => void;
  saveCurrentQuery: (name: string, icon?: string, color?: string) => SavedQueryRecord;
  deleteSavedQuery: (id: string) => void;
  refreshSavedQueries: () => void;
  openSaveModal: () => void;
  closeSaveModal: () => void;
}

const QueryContext = createContext<QueryContextType | null>(null);

const DEFAULT_FILTER: QueryFilterGroup = {
  operator: "AND",
  conditions: [],
};

const DEFAULT_SORT: QuerySortOption = {
  field: "created_at",
  direction: "DESC",
};

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeProject, activeView } = useProject();
  const { tickets } = useTickets();

  const [activeFilter, setActiveFilter] = useState<QueryFilterGroup>(DEFAULT_FILTER);
  const [activeSort, setActiveSort] = useState<QuerySortOption>(DEFAULT_SORT);
  const [queryResults, setQueryResults] = useState<EnrichedTicketRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [executionTimeMs, setExecutionTimeMs] = useState<number>(0);
  const [isQueryRunning, setIsQueryRunning] = useState<boolean>(false);
  const [savedQueries, setSavedQueries] = useState<SavedQueryRecord[]>([]);
  const [activeSavedQueryId, setActiveSavedQueryId] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);

  const services = useMemo(() => {
    try {
      const db = getDb();
      return {
        engine: new QueryEngine(db),
        saved: new SavedQueryService(db),
      };
    } catch {
      return null;
    }
  }, [user]);

  const refreshSavedQueries = useCallback(() => {
    if (!services || !user) {
      setSavedQueries([]);
      return;
    }
    try {
      const list = services.saved.listSavedQueries(user.id, activeProject?.id);
      setSavedQueries(list);
    } catch (err) {
      console.error("Failed to load saved queries:", err);
      setSavedQueries([]);
    }
  }, [services, user, activeProject]);

  const runQuery = useCallback(() => {
    if (!services || !user) {
      setQueryResults([]);
      setTotalCount(0);
      setExecutionTimeMs(0);
      return;
    }
    setIsQueryRunning(true);
    try {
      const res = services.engine.executeQuery({
        userId: user.id,
        projectId: activeProject?.id,
        filter: activeFilter,
        sort: activeSort,
      });
      setQueryResults(res.tickets);
      setTotalCount(res.totalCount);
      setExecutionTimeMs(res.executionTimeMs);
    } catch (err) {
      console.error("Query execution failed:", err);
      setQueryResults([]);
      setTotalCount(0);
    } finally {
      setIsQueryRunning(false);
    }
  }, [services, user, activeProject, activeFilter, activeSort, tickets, activeView]);

  // Execute query whenever filters, sort, active project, or tickets change
  useEffect(() => {
    runQuery();
  }, [runQuery]);

  useEffect(() => {
    refreshSavedQueries();
  }, [refreshSavedQueries]);

  const addCondition = useCallback((condition: FilterCondition) => {
    setActiveFilter((prev) => ({
      ...prev,
      conditions: [...prev.conditions, condition],
    }));
    setActiveSavedQueryId(null);
  }, []);

  const updateCondition = useCallback((index: number, condition: FilterCondition) => {
    setActiveFilter((prev) => {
      const next = [...prev.conditions];
      next[index] = condition;
      return { ...prev, conditions: next };
    });
    setActiveSavedQueryId(null);
  }, []);

  const removeCondition = useCallback((index: number) => {
    setActiveFilter((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
    setActiveSavedQueryId(null);
  }, []);

  const clearConditions = useCallback(() => {
    setActiveFilter(DEFAULT_FILTER);
    setActiveSavedQueryId(null);
  }, []);

  const setOperator = useCallback((operator: "AND" | "OR") => {
    setActiveFilter((prev) => ({
      ...prev,
      operator,
    }));
    setActiveSavedQueryId(null);
  }, []);

  const setSort = useCallback((sort: QuerySortOption) => {
    setActiveSort(sort);
    setActiveSavedQueryId(null);
  }, []);

  const loadSavedQuery = useCallback((sq: SavedQueryRecord) => {
    setActiveFilter(sq.filter);
    setActiveSort(sq.sort);
    setActiveSavedQueryId(sq.id);
  }, []);

  const saveCurrentQuery = useCallback(
    (name: string, icon?: string, color?: string): SavedQueryRecord => {
      if (!services || !user) throw new Error("Uninitialized");
      const saved = services.saved.createSavedQuery({
        userId: user.id,
        projectId: activeProject?.id,
        name,
        icon,
        color,
        filter: activeFilter,
        sort: activeSort,
      });
      setActiveSavedQueryId(saved.id);
      refreshSavedQueries();
      return saved;
    },
    [services, user, activeProject, activeFilter, activeSort, refreshSavedQueries]
  );

  const deleteSavedQuery = useCallback(
    (id: string) => {
      if (!services || !user) throw new Error("Uninitialized");
      services.saved.deleteSavedQuery(id, user.id);
      if (activeSavedQueryId === id) {
        setActiveSavedQueryId(null);
      }
      refreshSavedQueries();
    },
    [services, user, activeSavedQueryId, refreshSavedQueries]
  );

  const openSaveModal = useCallback(() => setIsSaveModalOpen(true), []);
  const closeSaveModal = useCallback(() => setIsSaveModalOpen(false), []);

  const value = {
    activeFilter,
    activeSort,
    queryResults,
    totalCount,
    executionTimeMs,
    isQueryRunning,
    savedQueries,
    activeSavedQueryId,
    isSaveModalOpen,
    addCondition,
    updateCondition,
    removeCondition,
    clearConditions,
    setOperator,
    setSort,
    runQuery,
    loadSavedQuery,
    saveCurrentQuery,
    deleteSavedQuery,
    refreshSavedQueries,
    openSaveModal,
    closeSaveModal,
  };

  return <QueryContext.Provider value={value}>{children}</QueryContext.Provider>;
}

export function useQuery() {
  const context = useContext(QueryContext);
  if (!context) {
    throw new Error("useQuery must be used within a QueryProvider");
  }
  return context;
}
