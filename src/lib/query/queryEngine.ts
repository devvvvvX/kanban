import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";
import type { TicketPriority, TicketRecord } from "../tickets/ticketService";
import type { WorkflowStateCategory } from "../tickets/workflowStateService";

export type FilterField =
  | "workflow_state_id"
  | "state_category"
  | "priority"
  | "epic_id"
  | "label"
  | "due_date"
  | "text"
  | "is_archived";

export type FilterOperator =
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "is_before"
  | "is_after"
  | "is_empty"
  | "is_not_empty";

export interface FilterCondition {
  id?: string;
  field: FilterField;
  operator: FilterOperator;
  value?: string | number | boolean | null;
}

export interface QueryFilterGroup {
  operator: "AND" | "OR";
  conditions: FilterCondition[];
}

export interface QuerySortOption {
  field: "created_at" | "updated_at" | "due_date" | "priority" | "title";
  direction: "ASC" | "DESC";
}

export interface EnrichedTicketRecord extends TicketRecord {
  workflow_state_name: string;
  workflow_state_category: WorkflowStateCategory;
  workflow_state_color: string;
  project_name: string;
  epic_title: string | null;
}

export interface ExecuteQueryOptions {
  userId: string;
  projectId?: string;
  filter: QueryFilterGroup;
  sort?: QuerySortOption;
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  tickets: EnrichedTicketRecord[];
  totalCount: number;
  executionTimeMs: number;
}

export class QueryEngine {
  constructor(private dbInstance?: ISqlDatabase) {}

  private get db(): ISqlDatabase {
    return this.dbInstance ?? getDb();
  }

  public executeQuery(options: ExecuteQueryOptions): QueryResult {
    const startTime = performance.now();
    const { userId, projectId, filter, sort, limit = 200, offset = 0 } = options;

    const params: unknown[] = [userId];
    const whereClauses: string[] = ["t.user_id = ?"];

    if (projectId) {
      whereClauses.push("t.project_id = ?");
      params.push(projectId);
    }

    // Default to unarchived unless condition explicitly tests is_archived
    const hasArchivedFilter = filter.conditions.some((c) => c.field === "is_archived");
    if (!hasArchivedFilter) {
      whereClauses.push("t.is_archived = 0");
    }

    // Compile filter conditions
    if (filter.conditions && filter.conditions.length > 0) {
      const conditionSqls: string[] = [];

      for (const cond of filter.conditions) {
        const compiled = this.compileCondition(cond, params);
        if (compiled) {
          conditionSqls.push(compiled);
        }
      }

      if (conditionSqls.length > 0) {
        const joinOp = filter.operator === "OR" ? " OR " : " AND ";
        whereClauses.push(`(${conditionSqls.join(joinOp)})`);
      }
    }

    const whereClause = whereClauses.join(" AND ");

    // Sorting
    let orderByClause = "ORDER BY t.created_at DESC";
    if (sort) {
      const dir = sort.direction === "ASC" ? "ASC" : "DESC";
      switch (sort.field) {
        case "priority":
          orderByClause = `ORDER BY CASE t.priority
            WHEN 'urgent' THEN 4
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 1
            ELSE 0 END ${dir}, t.created_at DESC`;
          break;
        case "due_date":
          // Put NULL due dates at the end
          orderByClause = `ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ${dir}`;
          break;
        case "title":
          orderByClause = `ORDER BY t.title COLLATE NOCASE ${dir}`;
          break;
        case "updated_at":
          orderByClause = `ORDER BY t.updated_at ${dir}`;
          break;
        case "created_at":
        default:
          orderByClause = `ORDER BY t.created_at ${dir}`;
          break;
      }
    }

    // Count query
    const countSql = `
      SELECT COUNT(*) as total
      FROM tickets t
      JOIN workflow_states ws ON ws.id = t.workflow_state_id
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN epics e ON e.id = t.epic_id
      WHERE ${whereClause}
    `;
    const countRow = this.db.prepare(countSql).get(...params) as { total: number };
    const totalCount = countRow?.total ?? 0;

    // Data query
    const dataSql = `
      SELECT
        t.*,
        ws.name AS workflow_state_name,
        ws.category AS workflow_state_category,
        ws.color AS workflow_state_color,
        p.name AS project_name,
        e.title AS epic_title
      FROM tickets t
      JOIN workflow_states ws ON ws.id = t.workflow_state_id
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN epics e ON e.id = t.epic_id
      WHERE ${whereClause}
      ${orderByClause}
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const rows = this.db.prepare(dataSql).all(...dataParams) as Array<{
      id: string;
      user_id: string;
      project_id: string;
      epic_id: string | null;
      workflow_state_id: string;
      parent_id: string | null;
      ticket_number: number;
      identifier: string;
      title: string;
      description: string | null;
      priority: TicketPriority;
      labels: string;
      due_date: string | null;
      estimate: number | null;
      position: number;
      is_archived: number;
      created_at: string;
      updated_at: string;
      workflow_state_name: string;
      workflow_state_category: WorkflowStateCategory;
      workflow_state_color: string;
      project_name: string;
      project_key: string;
      epic_title: string | null;
    }>;

    const tickets: EnrichedTicketRecord[] = rows.map((r) => {
      let labels: string[] = [];
      try {
        labels = JSON.parse(r.labels);
      } catch {
        labels = [];
      }
      return {
        ...r,
        labels,
      };
    });

    const endTime = performance.now();
    const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;

    return {
      tickets,
      totalCount,
      executionTimeMs,
    };
  }

  private compileCondition(cond: FilterCondition, params: unknown[]): string | null {
    const { field, operator, value } = cond;

    switch (field) {
      case "workflow_state_id":
        if (operator === "is") {
          params.push(value);
          return "t.workflow_state_id = ?";
        }
        if (operator === "is_not") {
          params.push(value);
          return "t.workflow_state_id != ?";
        }
        return null;

      case "state_category":
        if (operator === "is") {
          params.push(value);
          return "ws.category = ?";
        }
        if (operator === "is_not") {
          params.push(value);
          return "ws.category != ?";
        }
        return null;

      case "priority":
        if (operator === "is") {
          params.push(value);
          return "t.priority = ?";
        }
        if (operator === "is_not") {
          params.push(value);
          return "t.priority != ?";
        }
        return null;

      case "epic_id":
        if (operator === "is_empty") {
          return "t.epic_id IS NULL";
        }
        if (operator === "is_not_empty") {
          return "t.epic_id IS NOT NULL";
        }
        if (operator === "is") {
          params.push(value);
          return "t.epic_id = ?";
        }
        if (operator === "is_not") {
          params.push(value);
          return "(t.epic_id != ? OR t.epic_id IS NULL)";
        }
        return null;

      case "label":
        if (operator === "contains") {
          params.push(`%"${value}"%`);
          return "t.labels LIKE ?";
        }
        if (operator === "not_contains") {
          params.push(`%"${value}"%`);
          return "t.labels NOT LIKE ?";
        }
        return null;

      case "due_date":
        if (operator === "is_empty") {
          return "t.due_date IS NULL";
        }
        if (operator === "is_not_empty") {
          return "t.due_date IS NOT NULL";
        }
        if (operator === "is_before") {
          params.push(value);
          return "(t.due_date IS NOT NULL AND t.due_date < ?)";
        }
        if (operator === "is_after") {
          params.push(value);
          return "(t.due_date IS NOT NULL AND t.due_date > ?)";
        }
        if (operator === "is") {
          params.push(value);
          return "t.due_date = ?";
        }
        return null;

      case "text":
        if (operator === "contains") {
          const pattern = `%${value}%`;
          params.push(pattern, pattern, pattern);
          return "(t.title LIKE ? OR t.identifier LIKE ? OR t.description LIKE ?)";
        }
        return null;

      case "is_archived":
        params.push(value ? 1 : 0);
        return "t.is_archived = ?";

      default:
        return null;
    }
  }
}
