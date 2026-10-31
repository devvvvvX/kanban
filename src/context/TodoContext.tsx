import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  TodoService,
  type TodoRecord,
  type CreateTodoInput,
  type UpdateTodoInput,
  type ConvertTodoToTicketInput,
  type TodoCadence,
  type TodoStats,
} from "../lib/todos/todoService";
import type { TicketRecord } from "../lib/tickets/ticketService";
import { sendDesktopNotification } from "../utils/notifications";

export type TodoCadenceFilter = TodoCadence | "all";

export interface TodoContextValue {
  todos: TodoRecord[];
  activeCadence: TodoCadenceFilter;
  setActiveCadence: (cadence: TodoCadenceFilter) => void;
  activeCustomList: string | null;
  setActiveCustomList: (list: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  customLists: string[];
  stats: TodoStats;
  todayCount: number;
  totalActiveCount: number;
  starredCount: number;
  selectedTodo: TodoRecord | null;
  setSelectedTodo: (todo: TodoRecord | null) => void;
  createTodo: (input: CreateTodoInput) => TodoRecord;
  updateTodo: (id: string, updates: UpdateTodoInput) => TodoRecord;
  toggleTodo: (id: string) => TodoRecord;
  toggleStar: (id: string) => TodoRecord;
  reorderTodos: (orderedIds: string[]) => void;
  deleteTodo: (id: string) => boolean;
  convertTodoToTicket: (input: ConvertTodoToTicketInput) => { ticket: TicketRecord; todo: TodoRecord };
  addStep: (todoId: string, text: string) => TodoRecord;
  toggleStep: (todoId: string, stepId: string) => TodoRecord;
  removeStep: (todoId: string, stepId: string) => TodoRecord;
  setReminder: (todoId: string, remindAt: string | null) => TodoRecord;
  refreshTodos: () => void;
}

const DEFAULT_STATS: TodoStats = {
  totalActive: 0,
  dailyCount: 0,
  weeklyCount: 0,
  monthlyCount: 0,
  quarterlyCount: 0,
  customCount: 0,
  completedCount: 0,
  starredCount: 0,
};

export const TodoContext = createContext<TodoContextValue | undefined>(undefined);

export function TodoProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [todos, setTodos] = useState<TodoRecord[]>([]);
  const [activeCadence, setActiveCadence] = useState<TodoCadenceFilter>("daily");
  const [activeCustomList, setActiveCustomList] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState<TodoStats>(DEFAULT_STATS);
  const [customLists, setCustomLists] = useState<string[]>([]);
  const [selectedTodo, setSelectedTodo] = useState<TodoRecord | null>(null);

  const refreshTodos = useCallback(() => {
    if (!user) {
      setTodos([]);
      setStats(DEFAULT_STATS);
      setCustomLists([]);
      setSelectedTodo(null);
      return;
    }

    try {
      const service = new TodoService();
      const allList = service.getTodos(user.id);
      setTodos(allList);
      setStats(service.getTodoStats(user.id));
      setCustomLists(service.getCustomLists(user.id));

      // Keep selectedTodo updated with fresh data
      setSelectedTodo((prev) => {
        if (!prev) return null;
        const fresh = allList.find((t) => t.id === prev.id);
        return fresh || null;
      });
    } catch (err) {
      console.error("Failed to load todos:", err);
    }
  }, [user]);

  useEffect(() => {
    refreshTodos();
  }, [refreshTodos]);

  // Periodic reminder checking
  useEffect(() => {
    if (!user) return;
    const checkReminders = () => {
      try {
        const service = new TodoService();
        const pending = service.getPendingReminders(user.id);
        if (pending.length > 0) {
          for (const item of pending) {
            sendDesktopNotification({
              id: item.id,
              title: `Reminder: ${item.title}`,
              body: item.notes || "Todo reminder from your Kanban board",
              todoId: item.id,
              persistent: true,
              continuousRing: true,
            });
            service.markReminderSent(item.id, user.id);
          }
          refreshTodos();
        }
      } catch {
        // Ignore interval check errors
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 10000);
    return () => clearInterval(interval);
  }, [user, refreshTodos]);

  // Listen for open todo events from notification alerts
  useEffect(() => {
    const handleOpenTodo = (e: Event) => {
      const customEvent = e as CustomEvent<{ todoId?: string }>;
      const id = customEvent.detail?.todoId;
      if (id) {
        const found = todos.find((t) => t.id === id);
        if (found) {
          setSelectedTodo(found);
        }
      }
    };
    window.addEventListener("kanban:open-todo", handleOpenTodo);
    return () => window.removeEventListener("kanban:open-todo", handleOpenTodo);
  }, [todos]);

  // Listen for global data reloaded
  useEffect(() => {
    const handleReload = () => {
      refreshTodos();
    };
    window.addEventListener("kanban:data-reloaded", handleReload);
    return () => window.removeEventListener("kanban:data-reloaded", handleReload);
  }, [refreshTodos]);

  const handleCreateTodo = useCallback(
    (input: CreateTodoInput) => {
      if (!user) throw new Error("User must be signed in to create todos");
      const service = new TodoService();
      const created = service.createTodo(input, user.id);
      refreshTodos();
      return created;
    },
    [user, refreshTodos]
  );

  const handleUpdateTodo = useCallback(
    (id: string, updates: UpdateTodoInput) => {
      if (!user) throw new Error("User must be signed in to update todos");
      const service = new TodoService();
      const updated = service.updateTodo(id, updates, user.id);
      refreshTodos();
      return updated;
    },
    [user, refreshTodos]
  );

  const handleToggleTodo = useCallback(
    (id: string) => {
      if (!user) throw new Error("User must be signed in to toggle todos");
      const service = new TodoService();
      const toggled = service.toggleTodo(id, user.id);
      refreshTodos();
      return toggled;
    },
    [user, refreshTodos]
  );

  const handleToggleStar = useCallback(
    (id: string) => {
      if (!user) throw new Error("User must be signed in to star todos");
      const service = new TodoService();
      const toggled = service.toggleStar(id, user.id);
      refreshTodos();
      return toggled;
    },
    [user, refreshTodos]
  );

  const handleReorderTodos = useCallback(
    (orderedIds: string[]) => {
      if (!user) throw new Error("User must be signed in to reorder todos");
      const service = new TodoService();
      service.reorderTodos(orderedIds, user.id);
      refreshTodos();
    },
    [user, refreshTodos]
  );

  const handleDeleteTodo = useCallback(
    (id: string) => {
      if (!user) throw new Error("User must be signed in to delete todos");
      const service = new TodoService();
      const res = service.deleteTodo(id, user.id);
      refreshTodos();
      return res;
    },
    [user, refreshTodos]
  );

  const handleConvertTodoToTicket = useCallback(
    (input: ConvertTodoToTicketInput) => {
      if (!user) throw new Error("User must be signed in to convert todos");
      const service = new TodoService();
      const res = service.convertTodoToTicket(input, user.id);
      refreshTodos();
      return res;
    },
    [user, refreshTodos]
  );

  const handleAddStep = useCallback(
    (todoId: string, text: string) => {
      if (!user) throw new Error("User must be signed in to add steps");
      const service = new TodoService();
      const updated = service.addStep(todoId, text, user.id);
      refreshTodos();
      return updated;
    },
    [user, refreshTodos]
  );

  const handleToggleStep = useCallback(
    (todoId: string, stepId: string) => {
      if (!user) throw new Error("User must be signed in to toggle steps");
      const service = new TodoService();
      const updated = service.toggleStep(todoId, stepId, user.id);
      refreshTodos();
      return updated;
    },
    [user, refreshTodos]
  );

  const handleRemoveStep = useCallback(
    (todoId: string, stepId: string) => {
      if (!user) throw new Error("User must be signed in to remove steps");
      const service = new TodoService();
      const updated = service.removeStep(todoId, stepId, user.id);
      refreshTodos();
      return updated;
    },
    [user, refreshTodos]
  );

  const handleSetReminder = useCallback(
    (todoId: string, remindAt: string | null) => {
      if (!user) throw new Error("User must be signed in to set reminders");
      const service = new TodoService();
      const updated = service.setReminder(todoId, remindAt, user.id);
      refreshTodos();
      return updated;
    },
    [user, refreshTodos]
  );

  return (
    <TodoContext.Provider
      value={{
        todos,
        activeCadence,
        setActiveCadence,
        activeCustomList,
        setActiveCustomList,
        searchQuery,
        setSearchQuery,
        customLists,
        stats,
        todayCount: stats.dailyCount,
        totalActiveCount: stats.totalActive,
        starredCount: stats.starredCount,
        selectedTodo,
        setSelectedTodo,
        createTodo: handleCreateTodo,
        updateTodo: handleUpdateTodo,
        toggleTodo: handleToggleTodo,
        toggleStar: handleToggleStar,
        reorderTodos: handleReorderTodos,
        deleteTodo: handleDeleteTodo,
        convertTodoToTicket: handleConvertTodoToTicket,
        addStep: handleAddStep,
        toggleStep: handleToggleStep,
        removeStep: handleRemoveStep,
        setReminder: handleSetReminder,
        refreshTodos,
      }}
    >
      {children}
    </TodoContext.Provider>
  );
}

export function useTodos(): TodoContextValue {
  const ctx = useContext(TodoContext);
  if (!ctx) {
    throw new Error("useTodos must be used within a TodoProvider");
  }
  return ctx;
}
