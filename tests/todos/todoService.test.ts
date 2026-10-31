import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { TodoService } from "../../src/lib/todos/todoService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("TodoService", () => {
  let db: ISqlDatabase;
  let todoService: TodoService;
  let projectService: ProjectService;
  let workflowStateService: WorkflowStateService;
  const userA = "user-a";
  const userB = "user-b";

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);

    // Setup mock users
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
      VALUES (?, ?, 'hash', ?, 'active', datetime('now'), datetime('now'))
    `).run(userA, "usera@example.com", "User A");

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
      VALUES (?, ?, 'hash', ?, 'active', datetime('now'), datetime('now'))
    `).run(userB, "userb@example.com", "User B");

    todoService = new TodoService(db);
    projectService = new ProjectService(db);
    workflowStateService = new WorkflowStateService(db);
  });

  afterEach(() => {
    closeDb();
  });

  it("creates todos across different cadences with defaults and custom lists", () => {
    const dailyTodo = todoService.createTodo(
      {
        title: "Plan morning engineering review",
        notes: "Check PR #42 and unblock UI team",
        cadence: "daily",
        priority: "high",
      },
      userA
    );

    expect(dailyTodo.id).toBeDefined();
    expect(dailyTodo.title).toBe("Plan morning engineering review");
    expect(dailyTodo.notes).toBe("Check PR #42 and unblock UI team");
    expect(dailyTodo.cadence).toBe("daily");
    expect(dailyTodo.priority).toBe("high");
    expect(dailyTodo.is_completed).toBe(0);
    expect(dailyTodo.target_date).toBeDefined();

    const weeklyTodo = todoService.createTodo(
      {
        title: "Refactor database connection pooling",
        cadence: "weekly",
        priority: "medium",
      },
      userA
    );
    expect(weeklyTodo.cadence).toBe("weekly");

    const customTodo = todoService.createTodo(
      {
        title: "Explore Tauri v2 mobile plugin support",
        cadence: "custom",
        custom_list: "Braindump",
      },
      userA
    );
    expect(customTodo.cadence).toBe("custom");
    expect(customTodo.custom_list).toBe("Braindump");
  });

  it("filters todos by cadence, custom_list, completion status, and search query", () => {
    todoService.createTodo({ title: "Daily standup prep", cadence: "daily" }, userA);
    todoService.createTodo({ title: "Weekly sprint retro", cadence: "weekly" }, userA);
    todoService.createTodo({ title: "Monthly budget review", cadence: "monthly" }, userA);
    todoService.createTodo({ title: "Q4 Roadmap vision", cadence: "quarterly" }, userA);
    todoService.createTodo({ title: "Crazy idea: voice notes", cadence: "custom", custom_list: "Ideas" }, userA);

    // Filter by daily
    const daily = todoService.getTodos(userA, { cadence: "daily" });
    expect(daily).toHaveLength(1);
    expect(daily[0].title).toBe("Daily standup prep");

    // Filter by custom list
    const ideas = todoService.getTodos(userA, { custom_list: "Ideas" });
    expect(ideas).toHaveLength(1);
    expect(ideas[0].title).toBe("Crazy idea: voice notes");

    // Search query
    const searched = todoService.getTodos(userA, { searchQuery: "budget" });
    expect(searched).toHaveLength(1);
    expect(searched[0].title).toBe("Monthly budget review");

    // All active
    const all = todoService.getTodos(userA, { cadence: "all" });
    expect(all).toHaveLength(5);
  });

  it("toggles completion and tracks completed_at timestamp", () => {
    const todo = todoService.createTodo({ title: "Test toggle todo" }, userA);
    expect(todo.is_completed).toBe(0);
    expect(todo.completed_at).toBeNull();

    const completed = todoService.toggleTodo(todo.id, userA);
    expect(completed.is_completed).toBe(1);
    expect(completed.completed_at).toBeDefined();

    const reopened = todoService.toggleTodo(todo.id, userA);
    expect(reopened.is_completed).toBe(0);
    expect(reopened.completed_at).toBeNull();
  });

  it("updates todo fields and handles deletion", () => {
    const todo = todoService.createTodo({ title: "Original Title", priority: "low" }, userA);
    const updated = todoService.updateTodo(
      todo.id,
      {
        title: "Updated Title",
        priority: "urgent",
        notes: "Detailed unstructured notes",
      },
      userA
    );

    expect(updated.title).toBe("Updated Title");
    expect(updated.priority).toBe("urgent");
    expect(updated.notes).toBe("Detailed unstructured notes");

    const deleted = todoService.deleteTodo(todo.id, userA);
    expect(deleted).toBe(true);
    expect(todoService.getTodo(todo.id, userA)).toBeNull();
  });

  it("seamlessly converts a todo into a Kanban ticket and links them", () => {
    // Create a project first
    const project = projectService.createProject({
      userId: userA,
      name: "Personal OS",
      description: "Operating system workspace",
    });

    const states = workflowStateService.listStates(project.id, userA);
    expect(states.length).toBeGreaterThan(0);

    const todo = todoService.createTodo(
      {
        title: "Implement drag-and-drop card columns",
        notes: "Use HTML5 drag API or pointer events for smooth 60fps movement",
        cadence: "daily",
        priority: "high",
      },
      userA
    );

    const result = todoService.convertTodoToTicket(
      {
        todoId: todo.id,
        projectId: project.id,
        workflowStateId: states[0].id,
      },
      userA
    );

    expect(result.ticket).toBeDefined();
    expect(result.ticket.title).toBe("Implement drag-and-drop card columns");
    expect(result.ticket.description).toBe("Use HTML5 drag API or pointer events for smooth 60fps movement");
    expect(result.ticket.priority).toBe("high");
    expect(result.ticket.identifier).toMatch(/^[A-Z]{3,4}-\d+$/);

    expect(result.todo.converted_ticket_id).toBe(result.ticket.id);
    expect(result.todo.is_completed).toBe(1);
  });

  it("enforces strict user account isolation on todos", () => {
    const todoA = todoService.createTodo({ title: "User A Secret Plan" }, userA);

    // User B cannot get or see User A's todo
    expect(todoService.getTodo(todoA.id, userB)).toBeNull();
    const listB = todoService.getTodos(userB);
    expect(listB).toHaveLength(0);

    // User B cannot toggle or delete User A's todo
    expect(() => todoService.toggleTodo(todoA.id, userB)).toThrow(/Todo not found/);
    expect(() => todoService.updateTodo(todoA.id, { title: "Hacked" }, userB)).toThrow(/Todo not found/);
  });

  it("accurately computes statistics across cadences", () => {
    todoService.createTodo({ title: "Daily 1", cadence: "daily" }, userA);
    todoService.createTodo({ title: "Daily 2", cadence: "daily" }, userA);
    todoService.createTodo({ title: "Weekly 1", cadence: "weekly" }, userA);
    const monthly = todoService.createTodo({ title: "Monthly 1", cadence: "monthly" }, userA);
    todoService.createTodo({ title: "Custom 1", cadence: "custom", custom_list: "Ideas" }, userA);

    // Complete one monthly todo
    todoService.toggleTodo(monthly.id, userA);

    const stats = todoService.getTodoStats(userA);
    expect(stats.dailyCount).toBe(2);
    expect(stats.weeklyCount).toBe(1);
    expect(stats.monthlyCount).toBe(0); // active count
    expect(stats.customCount).toBe(1);
    expect(stats.completedCount).toBe(1);
    expect(stats.totalActive).toBe(4);

    const customLists = todoService.getCustomLists(userA);
    expect(customLists).toEqual(["Ideas"]);
  });

  it("supports star prioritization and sorts starred items to the top", () => {
    const todo1 = todoService.createTodo({ title: "Regular Task 1" }, userA);
    const todo2 = todoService.createTodo({ title: "Urgent Starred Task", is_starred: true }, userA);
    const todo3 = todoService.createTodo({ title: "Regular Task 2" }, userA);

    expect(todo2.is_starred).toBe(1);
    expect(todo1.is_starred).toBe(0);

    // List should return starred item first
    const list = todoService.getTodos(userA);
    expect(list[0].id).toBe(todo2.id);

    // Toggle star on todo3
    const starredTodo3 = todoService.toggleStar(todo3.id, userA);
    expect(starredTodo3.is_starred).toBe(1);

    // Unstar todo2
    const unstarredTodo2 = todoService.toggleStar(todo2.id, userA);
    expect(unstarredTodo2.is_starred).toBe(0);

    const updatedList = todoService.getTodos(userA);
    expect(updatedList[0].id).toBe(todo3.id);
  });

  it("reorders todos and persists new order", () => {
    const item1 = todoService.createTodo({ title: "Alpha" }, userA);
    const item2 = todoService.createTodo({ title: "Beta" }, userA);
    const item3 = todoService.createTodo({ title: "Gamma" }, userA);

    // Reverse order: item3, item2, item1
    todoService.reorderTodos([item3.id, item2.id, item1.id], userA);

    const reordered = todoService.getTodos(userA);
    expect(reordered.map((i) => i.id)).toEqual([item3.id, item2.id, item1.id]);
  });

  it("supports checkbox steps management with progress tracking", () => {
    const todo = todoService.createTodo({ title: "Launch checklist" }, userA);
    expect(todo.steps).toBe("[]");

    // Add steps
    todoService.addStep(todo.id, "Run test suite", userA);
    const withStep2 = todoService.addStep(todo.id, "Verify build", userA);

    const steps = JSON.parse(withStep2.steps || "[]");
    expect(steps).toHaveLength(2);
    expect(steps[0].text).toBe("Run test suite");
    expect(steps[0].completed).toBe(false);
    expect(steps[1].text).toBe("Verify build");

    // Toggle step completion
    const step1Id = steps[0].id;
    const toggled = todoService.toggleStep(todo.id, step1Id, userA);
    const toggledSteps = JSON.parse(toggled.steps || "[]");
    expect(toggledSteps[0].completed).toBe(true);

    // Remove step
    const removed = todoService.removeStep(todo.id, step1Id, userA);
    const remainingSteps = JSON.parse(removed.steps || "[]");
    expect(remainingSteps).toHaveLength(1);
    expect(remainingSteps[0].text).toBe("Verify build");
  });

  it("supports reminder scheduling, querying pending reminders, and marking sent", () => {
    const pastTime = new Date(Date.now() - 60000).toISOString();
    const futureTime = new Date(Date.now() + 3600000).toISOString();

    const todoWithPastReminder = todoService.createTodo({
      title: "Call candidate",
      remind_at: pastTime,
    }, userA);

    todoService.createTodo({
      title: "Future review",
      remind_at: futureTime,
    }, userA);

    // Query pending reminders
    const pending = todoService.getPendingReminders(userA);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(todoWithPastReminder.id);

    // Mark reminder as sent
    const updated = todoService.markReminderSent(todoWithPastReminder.id, userA);
    expect(updated.reminder_sent).toBe(1);

    // Should no longer appear in pending
    const remainingPending = todoService.getPendingReminders(userA);
    expect(remainingPending).toHaveLength(0);
  });
});
