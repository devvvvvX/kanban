import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useProject } from "./ProjectContext";
import {
  TicketService,
  type TicketRecord,
  type CreateTicketInput,
  type UpdateTicketInput,
} from "../lib/tickets/ticketService";
import {
  WorkflowStateService,
  type WorkflowStateRecord,
  type CreateStateInput,
  type UpdateStateInput,
} from "../lib/tickets/workflowStateService";
import {
  SubtaskService,
  type Subtask,
} from "../lib/tickets/subtaskService";
import {
  DependencyService,
  type EnrichedDependency,
  type DependencyRelationshipType,
} from "../lib/tickets/dependencyService";
import {
  CommentService,
  type TicketComment,
} from "../lib/tickets/commentService";
import {
  ActivityService,
  type TicketActivity,
} from "../lib/tickets/activityService";
import { getDb } from "../lib/db/connection";

export interface TicketContextType {
  tickets: TicketRecord[];
  ticketsByState: Record<string, TicketRecord[]>;
  workflowStates: WorkflowStateRecord[];
  selectedTicket: TicketRecord | null;
  selectedTicketId: string | null;
  isQuickCreateOpen: boolean;
  quickCreateStateId: string | null;
  subtaskProgress: Record<string, { total: number; completed: number }>;
  openQuickCreate: (defaultStateId?: string) => void;
  closeQuickCreate: () => void;
  openTicketDetail: (ticketId: string) => void;
  closeTicketDetail: () => void;
  createTicket: (input: Omit<CreateTicketInput, "userId" | "projectId">) => TicketRecord;
  updateTicket: (id: string, updates: UpdateTicketInput) => TicketRecord;
  moveTicket: (id: string, targetStateId: string, newPosition?: number) => TicketRecord;
  duplicateTicket: (id: string) => TicketRecord;
  archiveTicket: (id: string) => void;
  restoreTicket: (id: string) => void;
  unarchiveTicket: (id: string) => void;
  deleteTicket: (id: string) => void;
  archivedTickets: TicketRecord[];
  refreshArchivedTickets: () => void;
  isArchivedModalOpen: boolean;
  openArchivedModal: () => void;
  closeArchivedModal: () => void;
  createWorkflowState: (input: Omit<CreateStateInput, "userId" | "projectId">) => WorkflowStateRecord;
  updateWorkflowState: (id: string, updates: UpdateStateInput) => WorkflowStateRecord;
  deleteWorkflowState: (id: string, targetStateId?: string) => void;
  reorderWorkflowStates: (stateIds: string[]) => void;
  refreshTickets: () => void;
  refreshStates: () => void;
  refreshSubtaskProgress: () => void;
  listFilterCategory: "all" | "open" | "in_progress" | "completed";
  setListFilterCategory: (category: "all" | "open" | "in_progress" | "completed") => void;

  // Subtasks
  getSubtasks: (ticketId: string) => Subtask[];
  createSubtask: (ticketId: string, title: string) => Subtask;
  updateSubtask: (subtaskId: string, updates: { title?: string; is_completed?: boolean }) => Subtask;
  toggleSubtask: (subtaskId: string) => Subtask;
  deleteSubtask: (subtaskId: string) => void;
  reorderSubtasks: (ticketId: string, subtaskIds: string[]) => void;

  // Dependencies
  getDependencies: (ticketId: string) => EnrichedDependency[];
  linkTickets: (sourceId: string, targetId: string, type: DependencyRelationshipType) => void;
  unlinkTickets: (linkId: string) => void;

  // Comments & Activity
  getComments: (ticketId: string) => TicketComment[];
  addComment: (ticketId: string, content: string) => TicketComment;
  updateComment: (commentId: string, content: string) => TicketComment;
  deleteComment: (commentId: string) => void;
  getActivity: (ticketId: string) => TicketActivity[];
  recordActivity: (ticketId: string, actionType: string, details?: Record<string, unknown>) => TicketActivity;
}

export const TicketContext = createContext<TicketContextType | null>(null);

export function TicketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeProject } = useProject();

  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [archivedTickets, setArchivedTickets] = useState<TicketRecord[]>([]);
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState<boolean>(false);
  const [workflowStates, setWorkflowStates] = useState<WorkflowStateRecord[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState<boolean>(false);
  const [quickCreateStateId, setQuickCreateStateId] = useState<string | null>(null);
  const [subtaskProgress, setSubtaskProgress] = useState<Record<string, { total: number; completed: number }>>({});
  const [listFilterCategory, setListFilterCategory] = useState<"all" | "open" | "in_progress" | "completed">("all");

  const closeArchivedModal = useCallback(() => setIsArchivedModalOpen(false), []);

  const services = useMemo(() => {
    try {
      const db = getDb();
      return {
        ticket: new TicketService(db),
        workflow: new WorkflowStateService(db),
        subtask: new SubtaskService(db),
        dependency: new DependencyService(db),
        comment: new CommentService(db),
        activity: new ActivityService(db),
      };
    } catch {
      return null;
    }
  }, [user]);

  const refreshSubtaskProgress = useCallback(() => {
    if (!services || !user) {
      setSubtaskProgress({});
      return;
    }
    try {
      const map = services.subtask.getAllProgress(user.id);
      setSubtaskProgress(map);
    } catch (err) {
      console.error("Error refreshing subtask progress:", err);
      setSubtaskProgress({});
    }
  }, [services, user]);

  const refreshStates = useCallback(() => {
    if (!services || !user || !activeProject) {
      setWorkflowStates([]);
      return;
    }
    try {
      const list = services.workflow.listStates(activeProject.id, user.id);
      setWorkflowStates(list);
    } catch (err) {
      console.error("Error refreshing workflow states:", err);
      setWorkflowStates([]);
    }
  }, [services, user, activeProject]);

  const refreshTickets = useCallback(() => {
    if (!services || !user || !activeProject) {
      setTickets([]);
      return;
    }
    try {
      const list = services.ticket.listTickets(activeProject.id, user.id);
      setTickets(list);
    } catch (err) {
      console.error("Error refreshing tickets:", err);
      setTickets([]);
    }
  }, [services, user, activeProject]);

  const refreshArchivedTickets = useCallback(() => {
    if (!services || !user) {
      setArchivedTickets([]);
      return;
    }
    try {
      const list = services.ticket.listArchivedTickets(user.id, activeProject?.id);
      setArchivedTickets(list);
    } catch (err) {
      console.error("Error refreshing archived tickets:", err);
      setArchivedTickets([]);
    }
  }, [services, user, activeProject]);

  const openArchivedModal = useCallback(() => {
    refreshArchivedTickets();
    setIsArchivedModalOpen(true);
  }, [refreshArchivedTickets]);

  // Load states, tickets, archived tickets, and subtask progress when active project or user changes
  useEffect(() => {
    refreshStates();
    refreshTickets();
    refreshArchivedTickets();
    refreshSubtaskProgress();
    setSelectedTicketId(null);
  }, [refreshStates, refreshTickets, refreshArchivedTickets, refreshSubtaskProgress]);

  const openQuickCreate = useCallback((defaultStateId?: string) => {
    setQuickCreateStateId(defaultStateId || null);
    setIsQuickCreateOpen(true);
  }, []);

  const closeQuickCreate = useCallback(() => {
    setIsQuickCreateOpen(false);
    setQuickCreateStateId(null);
  }, []);

  const openTicketDetail = useCallback((ticketId: string) => {
    setSelectedTicketId(ticketId);
  }, []);

  const closeTicketDetail = useCallback(() => {
    setSelectedTicketId(null);
  }, []);

  const createTicket = useCallback(
    (input: Omit<CreateTicketInput, "userId" | "projectId">): TicketRecord => {
      if (!services || !user || !activeProject) {
        throw new Error("Active project or user uninitialized");
      }
      const created = services.ticket.createTicket({
        ...input,
        userId: user.id,
        projectId: activeProject.id,
      });
      // Record activity
      services.activity.recordActivity(user.id, created.id, user.email || "User", "created", {
        title: created.title,
      });
      refreshTickets();
      return created;
    },
    [services, user, activeProject, refreshTickets]
  );

  const updateTicket = useCallback(
    (id: string, updates: UpdateTicketInput): TicketRecord => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      const updated = services.ticket.updateTicket(id, user.id, updates);
      // Record activity
      services.activity.recordActivity(user.id, id, user.email || "User", "updated", updates as Record<string, unknown>);
      refreshTickets();
      return updated;
    },
    [services, user, refreshTickets]
  );

  const moveTicket = useCallback(
    (id: string, targetStateId: string, newPosition?: number): TicketRecord => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      const moved = services.ticket.moveTicket(id, user.id, targetStateId, newPosition);
      services.activity.recordActivity(user.id, id, user.email || "User", "state_changed", {
        targetStateId,
      });
      refreshTickets();
      return moved;
    },
    [services, user, refreshTickets]
  );

  const duplicateTicket = useCallback(
    (id: string): TicketRecord => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      const duplicated = services.ticket.duplicateTicket(id, user.id);
      services.activity.recordActivity(user.id, duplicated.id, user.email || "User", "duplicated", {
        originalTicketId: id,
      });
      refreshTickets();
      return duplicated;
    },
    [services, user, refreshTickets]
  );

  const archiveTicket = useCallback(
    (id: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.ticket.archiveTicket(id, user.id);
      services.activity.recordActivity(user.id, id, user.email || "User", "archived");
      refreshTickets();
      refreshArchivedTickets();
    },
    [services, user, refreshTickets, refreshArchivedTickets]
  );

  const restoreTicket = useCallback(
    (id: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.ticket.restoreTicket(id, user.id);
      services.activity.recordActivity(user.id, id, user.email || "User", "restored");
      refreshTickets();
      refreshArchivedTickets();
    },
    [services, user, refreshTickets, refreshArchivedTickets]
  );

  const unarchiveTicket = restoreTicket;

  const deleteTicket = useCallback(
    (id: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.ticket.deleteTicket(id, user.id);
      if (selectedTicketId === id) setSelectedTicketId(null);
      refreshTickets();
      refreshArchivedTickets();
      refreshSubtaskProgress();
    },
    [services, user, selectedTicketId, refreshTickets, refreshArchivedTickets, refreshSubtaskProgress]
  );

  const createWorkflowState = useCallback(
    (input: Omit<CreateStateInput, "userId" | "projectId">): WorkflowStateRecord => {
      if (!services || !user || !activeProject) {
        throw new Error("Active project or user uninitialized");
      }
      const created = services.workflow.createState({
        ...input,
        userId: user.id,
        projectId: activeProject.id,
      });
      refreshStates();
      return created;
    },
    [services, user, activeProject, refreshStates]
  );

  const updateWorkflowState = useCallback(
    (id: string, updates: UpdateStateInput): WorkflowStateRecord => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      const updated = services.workflow.updateState(id, user.id, updates);
      refreshStates();
      return updated;
    },
    [services, user, refreshStates]
  );

  const deleteWorkflowState = useCallback(
    (id: string, targetStateId?: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.workflow.deleteState(id, user.id, targetStateId);
      refreshStates();
      refreshTickets();
    },
    [services, user, refreshStates, refreshTickets]
  );

  const reorderWorkflowStates = useCallback(
    (stateIds: string[]) => {
      if (!services || !user || !activeProject) throw new Error("Uninitialized");
      services.workflow.reorderStates(activeProject.id, user.id, stateIds);
      refreshStates();
    },
    [services, user, activeProject, refreshStates]
  );

  // Subtask handlers
  const getSubtasks = useCallback(
    (ticketId: string): Subtask[] => {
      if (!services || !user) return [];
      return services.subtask.getSubtasks(user.id, ticketId);
    },
    [services, user]
  );

  const createSubtask = useCallback(
    (ticketId: string, title: string): Subtask => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      const created = services.subtask.createSubtask(user.id, ticketId, title);
      services.activity.recordActivity(user.id, ticketId, user.email || "User", "subtask_added", {
        title: created.title,
      });
      refreshSubtaskProgress();
      return created;
    },
    [services, user, refreshSubtaskProgress]
  );

  const updateSubtask = useCallback(
    (subtaskId: string, updates: { title?: string; is_completed?: boolean }): Subtask => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      const updated = services.subtask.updateSubtask(user.id, subtaskId, updates);
      refreshSubtaskProgress();
      return updated;
    },
    [services, user, refreshSubtaskProgress]
  );

  const toggleSubtask = useCallback(
    (subtaskId: string): Subtask => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      const toggled = services.subtask.toggleCompletion(user.id, subtaskId);
      services.activity.recordActivity(user.id, toggled.ticket_id, user.email || "User", "subtask_toggled", {
        title: toggled.title,
        completed: toggled.is_completed,
      });
      refreshSubtaskProgress();
      return toggled;
    },
    [services, user, refreshSubtaskProgress]
  );

  const deleteSubtask = useCallback(
    (subtaskId: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.subtask.deleteSubtask(user.id, subtaskId);
      refreshSubtaskProgress();
    },
    [services, user, refreshSubtaskProgress]
  );

  const reorderSubtasks = useCallback(
    (ticketId: string, subtaskIds: string[]) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.subtask.reorderSubtasks(user.id, ticketId, subtaskIds);
    },
    [services, user]
  );

  // Dependency handlers
  const getDependencies = useCallback(
    (ticketId: string): EnrichedDependency[] => {
      if (!services || !user) return [];
      return services.dependency.getDependencies(user.id, ticketId);
    },
    [services, user]
  );

  const linkTickets = useCallback(
    (sourceId: string, targetId: string, type: DependencyRelationshipType) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      const res = services.dependency.linkTickets(user.id, sourceId, targetId, type);
      services.activity.recordActivity(user.id, sourceId, user.email || "User", "dependency_linked", {
        targetTicketId: targetId,
        type,
      });
      services.activity.recordActivity(user.id, targetId, user.email || "User", "dependency_linked", {
        targetTicketId: sourceId,
        type: res.reciprocalLink.relationship_type,
      });
    },
    [services, user]
  );

  const unlinkTickets = useCallback(
    (linkId: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.dependency.unlinkTickets(user.id, linkId);
    },
    [services, user]
  );

  // Comment handlers
  const getComments = useCallback(
    (ticketId: string): TicketComment[] => {
      if (!services || !user) return [];
      return services.comment.listComments(user.id, ticketId);
    },
    [services, user]
  );

  const addComment = useCallback(
    (ticketId: string, content: string): TicketComment => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      const comment = services.comment.addComment(user.id, ticketId, content);
      services.activity.recordActivity(user.id, ticketId, user.email || "User", "comment_added");
      return comment;
    },
    [services, user]
  );

  const updateComment = useCallback(
    (commentId: string, content: string): TicketComment => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      return services.comment.updateComment(user.id, commentId, content);
    },
    [services, user]
  );

  const deleteComment = useCallback(
    (commentId: string) => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      services.comment.deleteComment(user.id, commentId);
    },
    [services, user]
  );

  // Activity handlers
  const getActivity = useCallback(
    (ticketId: string): TicketActivity[] => {
      if (!services || !user) return [];
      return services.activity.listActivity(user.id, ticketId);
    },
    [services, user]
  );

  const recordActivity = useCallback(
    (ticketId: string, actionType: string, details?: Record<string, unknown>): TicketActivity => {
      if (!services || !user) throw new Error("Database or user uninitialized");
      return services.activity.recordActivity(user.id, ticketId, user.email || "User", actionType, details);
    },
    [services, user]
  );

  // Group tickets by workflow state ID
  const ticketsByState = useMemo(() => {
    const map: Record<string, TicketRecord[]> = {};
    workflowStates.forEach((ws) => {
      map[ws.id] = [];
    });
    tickets.forEach((t) => {
      if (!map[t.workflow_state_id]) {
        map[t.workflow_state_id] = [];
      }
      map[t.workflow_state_id].push(t);
    });
    // Sort each bucket by position ascending
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => a.position - b.position);
    });
    return map;
  }, [workflowStates, tickets]);

  const selectedTicket = useMemo(() => {
    if (!selectedTicketId) return null;
    return (
      tickets.find((t) => t.id === selectedTicketId) ||
      archivedTickets.find((t) => t.id === selectedTicketId) ||
      (services && user ? services.ticket.getTicket(selectedTicketId, user.id) : null)
    );
  }, [tickets, archivedTickets, selectedTicketId, services, user]);

  const value = {
    tickets,
    archivedTickets,
    ticketsByState,
    workflowStates,
    selectedTicket,
    selectedTicketId,
    isQuickCreateOpen,
    quickCreateStateId,
    isArchivedModalOpen,
    openArchivedModal,
    closeArchivedModal,
    subtaskProgress,
    openQuickCreate,
    closeQuickCreate,
    openTicketDetail,
    closeTicketDetail,
    createTicket,
    updateTicket,
    moveTicket,
    duplicateTicket,
    archiveTicket,
    restoreTicket,
    unarchiveTicket,
    deleteTicket,
    refreshArchivedTickets,
    createWorkflowState,
    updateWorkflowState,
    deleteWorkflowState,
    reorderWorkflowStates,
    refreshTickets,
    refreshStates,
    refreshSubtaskProgress,
    listFilterCategory,
    setListFilterCategory,
    getSubtasks,
    createSubtask,
    updateSubtask,
    toggleSubtask,
    deleteSubtask,
    reorderSubtasks,
    getDependencies,
    linkTickets,
    unlinkTickets,
    getComments,
    addComment,
    updateComment,
    deleteComment,
    getActivity,
    recordActivity,
  };

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
}

export function useTickets() {
  const context = useContext(TicketContext);
  if (!context) {
    throw new Error("useTickets must be used within a TicketProvider");
  }
  return context;
}
