import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";
import { TicketService, type TicketRecord, type TicketPriority } from "../tickets/ticketService";
import { WorkflowStateService } from "../tickets/workflowStateService";

export type TodoCadence = "daily" | "weekly" | "monthly" | "quarterly" | "custom";
export type TodoPriority = "none" | "low" | "medium" | "high" | "urgent";

export interface TodoStep {
  id: string;
  text: string;
  completed: boolean;
}

export function parseTodoSteps(rawSteps: string | null | undefined): TodoStep[] {
  if (!rawSteps) return [];
  try {
    const parsed = JSON.parse(rawSteps);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export interface TodoRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  notes: string | null;
  cadence: TodoCadence;
  custom_list: string | null;
  target_date: string | null;
  is_completed: number;
  completed_at: string | null;
  priority: TodoPriority;
  is_starred: number;
  order_index: number;
  converted_ticket_id: string | null;
  steps: string | null;
  remind_at: string | null;
  reminder_sent: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTodoInput {
  title: string;
  notes?: string | null;
  cadence?: TodoCadence;
  custom_list?: string | null;
  target_date?: string | null;
  priority?: TodoPriority;
  is_starred?: boolean;
  projectId?: string | null;
  order_index?: number;
  steps?: TodoStep[] | string;
  remind_at?: string | null;
}

export interface UpdateTodoInput {
  title?: string;
  notes?: string | null;
  cadence?: TodoCadence;
  custom_list?: string | null;
  target_date?: string | null;
  priority?: TodoPriority;
  is_starred?: boolean;
  projectId?: string | null;
  order_index?: number;
  is_completed?: boolean;
  steps?: TodoStep[] | string;
  remind_at?: string | null;
  reminder_sent?: boolean;
}

export interface ConvertTodoToTicketInput {
  todoId: string;
  projectId: string;
  workflowStateId?: string;
  priority?: "none" | "low" | "medium" | "high" | "urgent";
  customTitle?: string;
  customDescription?: string;
  epicId?: string | null;
}

export interface TodoFilterOptions {
  cadence?: TodoCadence | "all";
  custom_list?: string | null;
  is_completed?: boolean;
  searchQuery?: string;
  projectId?: string | null;
  starredOnly?: boolean;
}

export interface TodoStats {
  totalActive: number;
  dailyCount: number;
  weeklyCount: number;
  monthlyCount: number;
  quarterlyCount: number;
  customCount: number;
  completedCount: number;
  starredCount: number;
}

export class TodoService {
  private db: ISqlDatabase;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
  }

  public createTodo(input: CreateTodoInput, userId: string): TodoRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = input.title.trim();
    if (!title) {
      throw new Error("Todo title cannot be empty");
    }

    const cadence: TodoCadence = input.cadence || "daily";
    const customList = input.custom_list?.trim() || null;
    const notes = input.notes?.trim() || null;
    const priority: TodoPriority = input.priority || "none";
    const isStarred = input.is_starred ? 1 : 0;
    const targetDate = input.target_date || (cadence === "daily" ? now.split("T")[0] : null);
    const orderIndex = input.order_index ?? 0;
    const projectId = input.projectId || null;
    const steps = input.steps
      ? typeof input.steps === "string"
        ? input.steps
        : JSON.stringify(input.steps)
      : "[]";
    const remindAt = input.remind_at || null;

    const stmt = this.db.prepare(`
      INSERT INTO todos (
        id, user_id, project_id, title, notes, cadence, custom_list,
        target_date, is_completed, completed_at, priority, is_starred, order_index,
        converted_ticket_id, steps, remind_at, reminder_sent, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, NULL, ?, ?, 0, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      projectId,
      title,
      notes,
      cadence,
      customList,
      targetDate,
      priority,
      isStarred,
      orderIndex,
      steps,
      remindAt,
      now,
      now
    );

    return {
      id,
      user_id: userId,
      project_id: projectId,
      title,
      notes,
      cadence,
      custom_list: customList,
      target_date: targetDate,
      is_completed: 0,
      completed_at: null,
      priority,
      is_starred: isStarred,
      order_index: orderIndex,
      converted_ticket_id: null,
      steps,
      remind_at: remindAt,
      reminder_sent: 0,
      created_at: now,
      updated_at: now,
    };
  }

  public getTodo(id: string, userId: string): TodoRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM todos WHERE id = ? AND user_id = ?
    `);
    const row = stmt.get(id, userId);
    if (!row) return null;
    const r = row as any;
    return {
      ...r,
      is_starred: r.is_starred ? 1 : 0,
      steps: r.steps ?? "[]",
      remind_at: r.remind_at ?? null,
      reminder_sent: r.reminder_sent ? 1 : 0,
    } as TodoRecord;
  }

  public getTodos(userId: string, options?: TodoFilterOptions): TodoRecord[] {
    let query = `SELECT * FROM todos WHERE user_id = ?`;
    const params: (string | number)[] = [userId];

    if (options?.cadence && options.cadence !== "all") {
      query += ` AND cadence = ?`;
      params.push(options.cadence);
    }

    if (options?.custom_list) {
      query += ` AND custom_list = ?`;
      params.push(options.custom_list);
    }

    if (options?.projectId) {
      query += ` AND project_id = ?`;
      params.push(options.projectId);
    }

    if (options?.starredOnly) {
      query += ` AND is_starred = 1`;
    }

    if (options?.is_completed !== undefined) {
      query += ` AND is_completed = ?`;
      params.push(options.is_completed ? 1 : 0);
    }

    if (options?.searchQuery && options.searchQuery.trim()) {
      query += ` AND (title LIKE ? OR notes LIKE ?)`;
      const term = `%${options.searchQuery.trim()}%`;
      params.push(term, term);
    }

    query += ` ORDER BY is_completed ASC, is_starred DESC, order_index ASC, created_at DESC`;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);
    return (rows as any[]).map((r) => ({
      ...r,
      is_starred: r.is_starred ? 1 : 0,
      steps: r.steps ?? "[]",
      remind_at: r.remind_at ?? null,
      reminder_sent: r.reminder_sent ? 1 : 0,
    })) as TodoRecord[];
  }

  public updateTodo(id: string, updates: UpdateTodoInput, userId: string): TodoRecord {
    const existing = this.getTodo(id, userId);
    if (!existing) {
      throw new Error(`Todo not found: ${id}`);
    }

    const title = updates.title !== undefined ? updates.title.trim() : existing.title;
    if (!title) {
      throw new Error("Todo title cannot be empty");
    }

    const notes = updates.notes !== undefined ? (updates.notes?.trim() || null) : existing.notes;
    const cadence = updates.cadence !== undefined ? updates.cadence : existing.cadence;
    const customList = updates.custom_list !== undefined ? (updates.custom_list?.trim() || null) : existing.custom_list;
    const targetDate = updates.target_date !== undefined ? updates.target_date : existing.target_date;
    const priority = updates.priority !== undefined ? updates.priority : existing.priority;
    const isStarred = updates.is_starred !== undefined ? (updates.is_starred ? 1 : 0) : existing.is_starred;
    const projectId = updates.projectId !== undefined ? updates.projectId : existing.project_id;
    const orderIndex = updates.order_index !== undefined ? updates.order_index : existing.order_index;
    const steps = updates.steps !== undefined
      ? typeof updates.steps === "string"
        ? updates.steps
        : JSON.stringify(updates.steps)
      : existing.steps;
    const remindAt = updates.remind_at !== undefined ? updates.remind_at : existing.remind_at;
    const reminderSent = updates.reminder_sent !== undefined
      ? (updates.reminder_sent ? 1 : 0)
      : (updates.remind_at !== undefined && updates.remind_at !== existing.remind_at ? 0 : existing.reminder_sent);
    
    let isCompleted = existing.is_completed;
    let completedAt = existing.completed_at;
    if (updates.is_completed !== undefined) {
      isCompleted = updates.is_completed ? 1 : 0;
      completedAt = updates.is_completed ? (existing.completed_at || new Date().toISOString()) : null;
    }

    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE todos
      SET title = ?, notes = ?, cadence = ?, custom_list = ?, target_date = ?,
          priority = ?, is_starred = ?, project_id = ?, order_index = ?, is_completed = ?,
          completed_at = ?, steps = ?, remind_at = ?, reminder_sent = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(
      title,
      notes,
      cadence,
      customList,
      targetDate,
      priority,
      isStarred,
      projectId,
      orderIndex,
      isCompleted,
      completedAt,
      steps,
      remindAt,
      reminderSent,
      now,
      id,
      userId
    );

    return {
      ...existing,
      title,
      notes,
      cadence,
      custom_list: customList,
      target_date: targetDate,
      priority,
      is_starred: isStarred,
      project_id: projectId,
      order_index: orderIndex,
      is_completed: isCompleted,
      completed_at: completedAt,
      steps,
      remind_at: remindAt,
      reminder_sent: reminderSent,
      updated_at: now,
    };
  }

  public addStep(todoId: string, text: string, userId: string): TodoRecord {
    const existing = this.getTodo(todoId, userId);
    if (!existing) {
      throw new Error(`Todo not found: ${todoId}`);
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return existing;
    }
    const currentSteps = parseTodoSteps(existing.steps);
    const newStep: TodoStep = {
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
    };
    const updatedSteps = [...currentSteps, newStep];
    return this.updateTodo(todoId, { steps: updatedSteps }, userId);
  }

  public toggleStep(todoId: string, stepId: string, userId: string): TodoRecord {
    const existing = this.getTodo(todoId, userId);
    if (!existing) {
      throw new Error(`Todo not found: ${todoId}`);
    }
    const currentSteps = parseTodoSteps(existing.steps);
    const updatedSteps = currentSteps.map((s) =>
      s.id === stepId ? { ...s, completed: !s.completed } : s
    );
    return this.updateTodo(todoId, { steps: updatedSteps }, userId);
  }

  public removeStep(todoId: string, stepId: string, userId: string): TodoRecord {
    const existing = this.getTodo(todoId, userId);
    if (!existing) {
      throw new Error(`Todo not found: ${todoId}`);
    }
    const currentSteps = parseTodoSteps(existing.steps);
    const updatedSteps = currentSteps.filter((s) => s.id !== stepId);
    return this.updateTodo(todoId, { steps: updatedSteps }, userId);
  }

  public updateSteps(todoId: string, steps: TodoStep[], userId: string): TodoRecord {
    return this.updateTodo(todoId, { steps }, userId);
  }

  public setReminder(todoId: string, remindAt: string | null, userId: string): TodoRecord {
    return this.updateTodo(todoId, { remind_at: remindAt, reminder_sent: false }, userId);
  }

  public markReminderSent(todoId: string, userId: string): TodoRecord {
    return this.updateTodo(todoId, { reminder_sent: true }, userId);
  }

  public getPendingReminders(userId: string): TodoRecord[] {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM todos
      WHERE user_id = ?
        AND is_completed = 0
        AND remind_at IS NOT NULL
        AND remind_at <= ?
        AND reminder_sent = 0
      ORDER BY remind_at ASC
    `);
    const rows = stmt.all(userId, now);
    return (rows as any[]).map((r) => ({
      ...r,
      is_starred: r.is_starred ? 1 : 0,
      steps: r.steps ?? "[]",
      remind_at: r.remind_at ?? null,
      reminder_sent: r.reminder_sent ? 1 : 0,
    })) as TodoRecord[];
  }

  public toggleTodo(id: string, userId: string): TodoRecord {
    const existing = this.getTodo(id, userId);
    if (!existing) {
      throw new Error(`Todo not found: ${id}`);
    }

    const newCompleted = existing.is_completed === 1 ? 0 : 1;
    const completedAt = newCompleted === 1 ? new Date().toISOString() : null;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE todos
      SET is_completed = ?, completed_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(newCompleted, completedAt, now, id, userId);

    return {
      ...existing,
      is_completed: newCompleted,
      completed_at: completedAt,
      updated_at: now,
    };
  }

  public toggleStar(id: string, userId: string): TodoRecord {
    const existing = this.getTodo(id, userId);
    if (!existing) {
      throw new Error(`Todo not found: ${id}`);
    }

    const newStarred = existing.is_starred === 1 ? 0 : 1;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE todos
      SET is_starred = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(newStarred, now, id, userId);

    return {
      ...existing,
      is_starred: newStarred,
      updated_at: now,
    };
  }

  public reorderTodos(orderedIds: string[], userId: string): void {
    if (!orderedIds || orderedIds.length === 0) return;

    const reorderTxn = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        UPDATE todos SET order_index = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `);
      const now = new Date().toISOString();
      orderedIds.forEach((id, index) => {
        stmt.run(index, now, id, userId);
      });
    });

    reorderTxn();
  }

  public deleteTodo(id: string, userId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM todos WHERE id = ? AND user_id = ?
    `);
    stmt.run(id, userId);
    return true;
  }

  public convertTodoToTicket(
    input: ConvertTodoToTicketInput,
    userId: string
  ): { ticket: TicketRecord; todo: TodoRecord } {
    const todo = this.getTodo(input.todoId, userId);
    if (!todo) {
      throw new Error(`Todo not found: ${input.todoId}`);
    }

    const stateService = new WorkflowStateService(this.db);
    let targetStateId = input.workflowStateId;
    if (!targetStateId) {
      const states = stateService.listStates(input.projectId, userId);
      const defaultState =
        states.find((s) => s.category === "unstarted" || s.category === "backlog") || states[0];
      if (!defaultState) {
        throw new Error(`No workflow states found for project ${input.projectId}`);
      }
      targetStateId = defaultState.id;
    }

    const ticketService = new TicketService(this.db);
    const title = input.customTitle?.trim() || todo.title;
    const description = input.customDescription !== undefined ? input.customDescription : todo.notes || undefined;
    const priority = (input.priority || (todo.priority !== "none" ? todo.priority : "medium")) as TicketPriority;

    const ticket = ticketService.createTicket({
      userId,
      projectId: input.projectId,
      workflowStateId: targetStateId,
      epicId: input.epicId || undefined,
      title,
      description: description || undefined,
      priority,
      dueDate: todo.target_date || undefined,
    });

    const now = new Date().toISOString();
    // Mark todo as linked to this ticket and mark as completed
    const stmt = this.db.prepare(`
      UPDATE todos
      SET converted_ticket_id = ?, is_completed = 1, completed_at = COALESCE(completed_at, ?), updated_at = ?
      WHERE id = ? AND user_id = ?
    `);
    stmt.run(ticket.id, now, now, todo.id, userId);

    const updatedTodo = this.getTodo(todo.id, userId)!;
    return { ticket, todo: updatedTodo };
  }

  public getTodoStats(userId: string): TodoStats {
    const todos = this.getTodos(userId);
    let totalActive = 0;
    let dailyCount = 0;
    let weeklyCount = 0;
    let monthlyCount = 0;
    let quarterlyCount = 0;
    let customCount = 0;
    let completedCount = 0;
    let starredCount = 0;

    for (const item of todos) {
      if (item.is_starred === 1 && item.is_completed === 0) {
        starredCount++;
      }
      if (item.is_completed === 1) {
        completedCount++;
      } else {
        totalActive++;
        if (item.cadence === "daily") dailyCount++;
        else if (item.cadence === "weekly") weeklyCount++;
        else if (item.cadence === "monthly") monthlyCount++;
        else if (item.cadence === "quarterly") quarterlyCount++;
        else if (item.cadence === "custom") customCount++;
      }
    }

    return {
      totalActive,
      dailyCount,
      weeklyCount,
      monthlyCount,
      quarterlyCount,
      customCount,
      completedCount,
      starredCount,
    };
  }

  public getCustomLists(userId: string): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT custom_list FROM todos
      WHERE user_id = ? AND custom_list IS NOT NULL AND custom_list != ''
      ORDER BY custom_list ASC
    `);
    const rows = stmt.all(userId) as { custom_list: string }[];
    return rows.map((r) => r.custom_list);
  }
}
