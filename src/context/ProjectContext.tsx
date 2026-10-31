import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useWorkspace } from "./WorkspaceContext";
import { ProjectService, type ProjectRecord, type CreateProjectInput, type UpdateProjectInput } from "../lib/projects/projectService";
import { EpicService, type EpicRecord, type CreateEpicInput, type UpdateEpicInput } from "../lib/projects/epicService";
import { RollupService, type ProjectMetrics, type EpicRollup } from "../lib/projects/rollupService";
import { WorkflowStateService } from "../lib/tickets/workflowStateService";
import { getDb } from "../lib/db/connection";

export type ProjectViewTab = "overview" | "board" | "list" | "epics" | "query";

const memoryStore = new Map<string, string>();
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem(key);
      }
    } catch {
      // Fallback to memoryStore
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
      // Fallback to memoryStore
    }
    memoryStore.set(key, value);
  },
  removeItem: (key: string): void => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
        return;
      }
    } catch {
      // Fallback to memoryStore
    }
    memoryStore.delete(key);
  },
};

export interface ProjectContextType {
  projects: ProjectRecord[];
  pinnedProjects: ProjectRecord[];
  activeProject: ProjectRecord | null;
  activeView: ProjectViewTab;
  epics: EpicRecord[];
  metrics: ProjectMetrics | null;
  isLoading: boolean;
  selectProject: (projectId: string | null) => void;
  setActiveView: (view: ProjectViewTab) => void;
  createProject: (input: Omit<CreateProjectInput, "userId">) => ProjectRecord;
  updateProject: (id: string, updates: UpdateProjectInput) => ProjectRecord;
  togglePin: (id: string) => void;
  archiveProject: (id: string) => void;
  restoreProject: (id: string) => void;
  deleteProject: (id: string) => void;
  createEpic: (input: Omit<CreateEpicInput, "userId" | "projectId">) => EpicRecord;
  updateEpic: (id: string, updates: UpdateEpicInput) => EpicRecord;
  archiveEpic: (id: string) => void;
  restoreEpic: (id: string) => void;
  deleteEpic: (id: string) => void;
  getEpicRollup: (epicId: string) => EpicRollup | null;
  refreshProjects: () => void;
  refreshEpics: () => void;
}

export const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectRecord | null>(null);
  const [activeView, setActiveViewState] = useState<ProjectViewTab>("overview");
  const [epics, setEpics] = useState<EpicRecord[]>([]);
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Memoize domain services using SQLite connection
  const services = useMemo(() => {
    try {
      const db = getDb();
      return {
        project: new ProjectService(db),
        epic: new EpicService(db),
        rollup: new RollupService(db),
        workflow: new WorkflowStateService(db),
      };
    } catch {
      return null;
    }
  }, [user]);

  const refreshEpics = useCallback(() => {
    if (!services || !user || !activeProject) {
      setEpics([]);
      setMetrics(null);
      return;
    }

    try {
      const list = services.epic.listEpics(activeProject.id, user.id);
      setEpics(list);
      const m = services.rollup.getProjectMetrics(activeProject.id, user.id);
      setMetrics(m);
    } catch (err) {
      console.error("Error refreshing epics/metrics:", err);
      setEpics([]);
      setMetrics(null);
    }
  }, [services, user, activeProject]);

  const refreshProjects = useCallback(() => {
    if (!services || !user || !isAuthenticated) {
      setProjects([]);
      setActiveProject(null);
      setEpics([]);
      setMetrics(null);
      setIsLoading(false);
      return;
    }

    try {
      const list = services.project.listProjects(user.id, {
        workspaceId: activeWorkspace?.id,
      });
      setProjects(list);

      // Restore active project preference
      const savedProjKey = `kanban_active_project_${user.id}_${activeWorkspace?.id || "default"}`;
      const savedProjId = safeStorage.getItem(savedProjKey);
      let nextActive: ProjectRecord | null = null;

      if (savedProjId) {
        nextActive = list.find((p) => p.id === savedProjId) || null;
      }

      // Default to first pinned project, then first active project
      if (!nextActive && list.length > 0) {
        nextActive = list.find((p) => p.is_pinned === 1) || list[0];
      }

      setActiveProject(nextActive);

      // Restore active view preference
      const savedViewKey = `kanban_active_view_${user.id}`;
      const savedView = safeStorage.getItem(savedViewKey) as ProjectViewTab | null;
      if (savedView && ["overview", "board", "list", "epics"].includes(savedView)) {
        setActiveViewState(savedView);
      } else {
        setActiveViewState("overview");
      }
    } catch (err) {
      console.error("Error refreshing projects:", err);
      setProjects([]);
      setActiveProject(null);
    } finally {
      setIsLoading(false);
    }
  }, [services, user, isAuthenticated, activeWorkspace]);

  // Reload projects whenever user or activeWorkspace changes
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Reload epics and metrics whenever active project changes
  useEffect(() => {
    refreshEpics();
  }, [refreshEpics]);

  const selectProject = useCallback(
    (projectId: string | null) => {
      if (!user) return;
      const savedProjKey = `kanban_active_project_${user.id}_${activeWorkspace?.id || "default"}`;
      if (!projectId) {
        setActiveProject(null);
        safeStorage.removeItem(savedProjKey);
        return;
      }
      const found = projects.find((p) => p.id === projectId) || null;
      setActiveProject(found);
      if (found) {
        safeStorage.setItem(savedProjKey, found.id);
      }
    },
    [user, projects, activeWorkspace]
  );

  const setActiveView = useCallback(
    (view: ProjectViewTab) => {
      setActiveViewState(view);
      if (user) {
        safeStorage.setItem(`kanban_active_view_${user.id}`, view);
      }
    },
    [user]
  );

  const createProject = useCallback(
    (input: Omit<CreateProjectInput, "userId">): ProjectRecord => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      const created = services.project.createProject({
        ...input,
        userId: user.id,
        workspaceId: input.workspaceId || activeWorkspace?.id,
      });
      // Initialize default workflow states (Backlog, Todo, In Progress, Done)
      services.workflow.ensureDefaultStates(created.id, user.id);
      refreshProjects();
      setActiveProject(created);
      const savedProjKey = `kanban_active_project_${user.id}_${activeWorkspace?.id || "default"}`;
      safeStorage.setItem(savedProjKey, created.id);
      return created;
    },
    [services, user, activeWorkspace, refreshProjects]
  );

  const updateProject = useCallback(
    (id: string, updates: UpdateProjectInput): ProjectRecord => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      const updated = services.project.updateProject(id, user.id, updates);
      refreshProjects();
      if (activeProject?.id === id) {
        setActiveProject(updated);
      }
      return updated;
    },
    [services, user, activeProject, refreshProjects]
  );

  const togglePin = useCallback(
    (id: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.project.togglePin(id, user.id);
      refreshProjects();
    },
    [services, user, refreshProjects]
  );

  const archiveProject = useCallback(
    (id: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.project.archiveProject(id, user.id);
      refreshProjects();
    },
    [services, user, refreshProjects]
  );

  const restoreProject = useCallback(
    (id: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.project.restoreProject(id, user.id);
      refreshProjects();
    },
    [services, user, refreshProjects]
  );

  const deleteProject = useCallback(
    (id: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.project.deleteProject(id, user.id);
      if (activeProject?.id === id) {
        setActiveProject(null);
      }
      refreshProjects();
    },
    [services, user, activeProject, refreshProjects]
  );

  const createEpic = useCallback(
    (input: Omit<CreateEpicInput, "userId" | "projectId">): EpicRecord => {
      if (!services || !user || !activeProject) {
        throw new Error("Active project or user not selected");
      }
      const created = services.epic.createEpic({
        ...input,
        userId: user.id,
        projectId: activeProject.id,
      });
      refreshEpics();
      return created;
    },
    [services, user, activeProject, refreshEpics]
  );

  const updateEpic = useCallback(
    (id: string, updates: UpdateEpicInput): EpicRecord => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      const updated = services.epic.updateEpic(id, user.id, updates);
      refreshEpics();
      return updated;
    },
    [services, user, refreshEpics]
  );

  const archiveEpic = useCallback(
    (id: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.epic.archiveEpic(id, user.id);
      refreshEpics();
    },
    [services, user, refreshEpics]
  );

  const restoreEpic = useCallback(
    (id: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.epic.restoreEpic(id, user.id);
      refreshEpics();
    },
    [services, user, refreshEpics]
  );

  const deleteEpic = useCallback(
    (id: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.epic.deleteEpic(id, user.id);
      refreshEpics();
    },
    [services, user, refreshEpics]
  );

  const getEpicRollup = useCallback(
    (epicId: string): EpicRollup | null => {
      if (!services || !user) return null;
      try {
        return services.rollup.getEpicRollup(epicId, user.id);
      } catch {
        return null;
      }
    },
    [services, user]
  );

  const pinnedProjects = useMemo(
    () => projects.filter((p) => p.is_pinned === 1),
    [projects]
  );

  return (
    <ProjectContext.Provider
      value={{
        projects,
        pinnedProjects,
        activeProject,
        activeView,
        epics,
        metrics,
        isLoading,
        selectProject,
        setActiveView,
        createProject,
        updateProject,
        togglePin,
        archiveProject,
        restoreProject,
        deleteProject,
        createEpic,
        updateEpic,
        archiveEpic,
        restoreEpic,
        deleteEpic,
        getEpicRollup,
        refreshProjects,
        refreshEpics,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextType {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
