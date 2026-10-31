import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export type SearchResultType = "ticket" | "epic" | "project";

export interface SearchMatchHighlight {
  text: string;
  isMatch: boolean;
}

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  identifier?: string;
  badge?: string;
  badgeColor?: string;
  projectId?: string;
  projectName?: string;
  fragments: SearchMatchHighlight[];
}

export interface GlobalSearchResult {
  query: string;
  tickets: SearchResultItem[];
  epics: SearchResultItem[];
  projects: SearchResultItem[];
  total: number;
  durationMs: number;
}

export function highlightMatches(
  text: string,
  query: string
): SearchMatchHighlight[] {
  if (!text) return [];
  if (!query || !query.trim()) {
    return [{ text, isMatch: false }];
  }

  const trimmed = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const fragments: SearchMatchHighlight[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const matchIndex = lower.indexOf(trimmed, startIndex);
    if (matchIndex === -1) {
      fragments.push({
        text: text.slice(startIndex),
        isMatch: false,
      });
      break;
    }

    if (matchIndex > startIndex) {
      fragments.push({
        text: text.slice(startIndex, matchIndex),
        isMatch: false,
      });
    }

    fragments.push({
      text: text.slice(matchIndex, matchIndex + trimmed.length),
      isMatch: true,
    });

    startIndex = matchIndex + trimmed.length;
  }

  return fragments;
}

export class SearchService {
  constructor(private dbInstance?: ISqlDatabase) {}

  private get db(): ISqlDatabase {
    return this.dbInstance ?? getDb();
  }

  public search(userId: string, rawQuery: string, limit = 20): GlobalSearchResult {
    const startTime = performance.now();
    const query = rawQuery.trim();

    if (!query) {
      return {
        query: "",
        tickets: [],
        epics: [],
        projects: [],
        total: 0,
        durationMs: 0,
      };
    }

    const pattern = `%${query}%`;

    // 1. Search tickets
    const ticketRows = this.db
      .prepare(
        `SELECT
           t.id,
           t.identifier,
           t.title,
           t.description,
           t.project_id,
           ws.name AS workflow_state_name,
           ws.color AS workflow_state_color,
           p.name AS project_name
         FROM tickets t
         JOIN workflow_states ws ON ws.id = t.workflow_state_id
         JOIN projects p ON p.id = t.project_id
         WHERE t.user_id = ?
           AND t.is_archived = 0
           AND (t.identifier LIKE ? OR t.title LIKE ? OR t.description LIKE ?)
         ORDER BY t.updated_at DESC
         LIMIT ?`
      )
      .all(userId, pattern, pattern, pattern, limit) as Array<{
        id: string;
        identifier: string;
        title: string;
        description: string | null;
        project_id: string;
        workflow_state_name: string;
        workflow_state_color: string;
        project_name: string;
      }>;

    const tickets: SearchResultItem[] = ticketRows.map((r) => {
      // Find matching fragment in identifier, title, or description
      let sampleText = `${r.identifier}: ${r.title}`;
      if (
        r.description &&
        r.description.toLowerCase().includes(query.toLowerCase()) &&
        !r.title.toLowerCase().includes(query.toLowerCase()) &&
        !r.identifier.toLowerCase().includes(query.toLowerCase())
      ) {
        sampleText = `${r.identifier}: ${r.title} — ${r.description.slice(0, 80)}`;
      }

      return {
        id: r.id,
        type: "ticket",
        title: r.title,
        subtitle: r.project_name,
        identifier: r.identifier,
        badge: r.workflow_state_name,
        badgeColor: r.workflow_state_color,
        projectId: r.project_id,
        projectName: r.project_name,
        fragments: highlightMatches(sampleText, query),
      };
    });

    // 2. Search epics
    const epicRows = this.db
      .prepare(
        `SELECT
           e.id,
           e.title,
           e.description,
           e.status,
           e.color,
           e.project_id,
           p.name AS project_name
         FROM epics e
         JOIN projects p ON p.id = e.project_id
         WHERE e.user_id = ?
           AND (e.title LIKE ? OR e.description LIKE ?)
         ORDER BY e.updated_at DESC
         LIMIT ?`
      )
      .all(userId, pattern, pattern, limit) as Array<{
        id: string;
        title: string;
        description: string | null;
        status: string;
        color: string;
        project_id: string;
        project_name: string;
      }>;

    const epics: SearchResultItem[] = epicRows.map((r) => ({
      id: r.id,
      type: "epic",
      title: r.title,
      subtitle: r.project_name,
      badge: r.status,
      badgeColor: r.color,
      projectId: r.project_id,
      projectName: r.project_name,
      fragments: highlightMatches(r.title, query),
    }));

    // 3. Search projects
    const projectRows = this.db
      .prepare(
        `SELECT
           p.id,
           p.name,
           p.description,
           p.color
         FROM projects p
         WHERE p.user_id = ?
           AND p.is_archived = 0
           AND (p.name LIKE ? OR p.description LIKE ?)
         ORDER BY p.updated_at DESC
         LIMIT ?`
      )
      .all(userId, pattern, pattern, limit) as Array<{
        id: string;
        name: string;
        description: string | null;
        color: string;
      }>;

    const projects: SearchResultItem[] = projectRows.map((r) => ({
      id: r.id,
      type: "project",
      title: r.name,
      subtitle: r.description || "Project",
      badgeColor: r.color,
      projectId: r.id,
      projectName: r.name,
      fragments: highlightMatches(r.name, query),
    }));

    const endTime = performance.now();
    const durationMs = Math.round((endTime - startTime) * 100) / 100;
    const total = tickets.length + epics.length + projects.length;

    return {
      query,
      tickets,
      epics,
      projects,
      total,
      durationMs,
    };
  }
}
