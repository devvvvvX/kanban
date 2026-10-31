import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import {
  WorkspaceService,
  type WorkspaceRecord,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from "../lib/workspaces/workspaceService";
import { getDb } from "../lib/db/connection";

const memoryStore = new Map<string, string>();
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem(key);
      }
    } catch {
      // Fallback
    }
    return memoryStore.get(key) || null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Fallback
    }
    memoryStore.set(key, value);
  },
};

export interface WorkspaceContextType {
  workspaces: WorkspaceRecord[];
  activeWorkspace: WorkspaceRecord | null;
  isLoading: boolean;
  selectWorkspace: (workspaceId: string) => void;
  createWorkspace: (input: Omit<CreateWorkspaceInput, "userId">) => WorkspaceRecord;
  updateWorkspace: (id: string, updates: UpdateWorkspaceInput) => WorkspaceRecord;
  deleteWorkspace: (id: string) => void;
  refreshWorkspaces: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const service = useMemo(() => {
    try {
      const db = getDb();
      return new WorkspaceService(db);
    } catch {
      return null;
    }
  }, [user]);

  const refreshWorkspaces = useCallback(() => {
    if (!service || !user || !isAuthenticated) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setIsLoading(false);
      return;
    }

    try {
      // Ensure default workspace exists
      service.ensureDefaultWorkspace(user.id, user.display_name);
      const list = service.listWorkspaces(user.id);
      setWorkspaces(list);

      const savedWsKey = `kanban_active_workspace_${user.id}`;
      const savedWsId = safeStorage.getItem(savedWsKey);
      let nextActive: WorkspaceRecord | null = null;

      if (savedWsId) {
        nextActive = list.find((w) => w.id === savedWsId) || null;
      }

      if (!nextActive && list.length > 0) {
        nextActive = list.find((w) => w.is_default === 1) || list[0];
      }

      setActiveWorkspace(nextActive);
      if (nextActive) {
        safeStorage.setItem(savedWsKey, nextActive.id);
      }
    } catch (err) {
      console.error("Error loading workspaces:", err);
      setWorkspaces([]);
      setActiveWorkspace(null);
    } finally {
      setIsLoading(false);
    }
  }, [service, user, isAuthenticated]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      const found = workspaces.find((w) => w.id === workspaceId);
      if (found) {
        setActiveWorkspace(found);
        if (user) {
          safeStorage.setItem(`kanban_active_workspace_${user.id}`, found.id);
        }
      }
    },
    [workspaces, user]
  );

  const createWorkspace = useCallback(
    (input: Omit<CreateWorkspaceInput, "userId">): WorkspaceRecord => {
      if (!service || !user) throw new Error("Authentication required");
      const created = service.createWorkspace({
        ...input,
        userId: user.id,
      });
      refreshWorkspaces();
      setActiveWorkspace(created);
      if (user) {
        safeStorage.setItem(`kanban_active_workspace_${user.id}`, created.id);
      }
      return created;
    },
    [service, user, refreshWorkspaces]
  );

  const updateWorkspace = useCallback(
    (id: string, updates: UpdateWorkspaceInput): WorkspaceRecord => {
      if (!service || !user) throw new Error("Authentication required");
      const updated = service.updateWorkspace(id, user.id, updates);
      refreshWorkspaces();
      return updated;
    },
    [service, user, refreshWorkspaces]
  );

  const deleteWorkspace = useCallback(
    (id: string) => {
      if (!service || !user) throw new Error("Authentication required");
      service.deleteWorkspace(id, user.id);
      refreshWorkspaces();
    },
    [service, user, refreshWorkspaces]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        isLoading,
        selectWorkspace,
        createWorkspace,
        updateWorkspace,
        deleteWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextType {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
