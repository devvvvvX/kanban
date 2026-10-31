import {
  Plus,
  X,
  SlidersHorizontal,
  Bookmark,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";
import { useQuery } from "../../context/QueryContext";
import { useTickets } from "../../context/TicketContext";
import { useProject } from "../../context/ProjectContext";
import type {
  FilterField,
  FilterOperator,
  FilterCondition,
  QuerySortOption,
} from "../../lib/query/queryEngine";

const FIELD_OPTIONS: Array<{ value: FilterField; label: string }> = [
  { value: "state_category", label: "State Category" },
  { value: "priority", label: "Priority" },
  { value: "label", label: "Label" },
  { value: "due_date", label: "Due Date" },
  { value: "epic_id", label: "Epic" },
  { value: "text", label: "Search Text" },
];

const OPERATOR_CONFIG: Record<FilterField, Array<{ value: FilterOperator; label: string }>> = {
  state_category: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
  ],
  priority: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
  ],
  label: [
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
  ],
  due_date: [
    { value: "is_before", label: "is before" },
    { value: "is_after", label: "is after" },
    { value: "is_empty", label: "has no due date" },
    { value: "is_not_empty", label: "has a due date" },
  ],
  epic_id: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
    { value: "is_empty", label: "has no epic" },
    { value: "is_not_empty", label: "has an epic" },
  ],
  text: [
    { value: "contains", label: "contains" },
  ],
  workflow_state_id: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
  ],
  is_archived: [
    { value: "is", label: "is" },
  ],
};

const SORT_FIELDS: Array<{ value: QuerySortOption["field"]; label: string }> = [
  { value: "priority", label: "Priority" },
  { value: "due_date", label: "Due Date" },
  { value: "created_at", label: "Created Date" },
  { value: "updated_at", label: "Updated Date" },
  { value: "title", label: "Title" },
];

export function QueryBuilder() {
  const {
    activeFilter,
    activeSort,
    addCondition,
    updateCondition,
    removeCondition,
    clearConditions,
    setOperator,
    setSort,
    openSaveModal,
    totalCount,
    executionTimeMs,
  } = useQuery();

  const { epics } = useProject();
  const { workflowStates } = useTickets();

  const handleAddField = () => {
    const newCond: FilterCondition = {
      id: crypto.randomUUID(),
      field: "priority",
      operator: "is",
      value: "urgent",
    };
    addCondition(newCond);
  };

  const handleFieldChange = (index: number, newField: FilterField) => {
    const allowedOps = OPERATOR_CONFIG[newField];
    const defaultOp = allowedOps[0].value;
    let defaultValue: unknown = "";

    if (newField === "priority") defaultValue = "high";
    else if (newField === "state_category") defaultValue = "started";
    else if (newField === "due_date") defaultValue = new Date().toISOString().split("T")[0];
    else if (newField === "epic_id" && epics.length > 0) defaultValue = epics[0].id;

    updateCondition(index, {
      field: newField,
      operator: defaultOp,
      value: defaultValue as string,
    });
  };

  const renderValueInput = (cond: FilterCondition, index: number) => {
    // If operator is is_empty or is_not_empty, no value input needed
    if (cond.operator === "is_empty" || cond.operator === "is_not_empty") {
      return null;
    }

    switch (cond.field) {
      case "state_category":
        return (
          <select
            value={String(cond.value || "unstarted")}
            onChange={(e) => updateCondition(index, { ...cond, value: e.target.value })}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-subtle)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          >
            <option value="backlog">Backlog</option>
            <option value="unstarted">Unstarted (Todo)</option>
            <option value="started">Started (In Progress)</option>
            <option value="completed">Completed (Done)</option>
            <option value="cancelled">Cancelled</option>
          </select>
        );

      case "workflow_state_id":
        return (
          <select
            value={String(cond.value || (workflowStates[0]?.id ?? ""))}
            onChange={(e) => updateCondition(index, { ...cond, value: e.target.value })}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-subtle)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          >
            {workflowStates.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        );

      case "priority":
        return (
          <select
            value={String(cond.value || "urgent")}
            onChange={(e) => updateCondition(index, { ...cond, value: e.target.value })}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-subtle)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          >
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">None</option>
          </select>
        );

      case "epic_id":
        return (
          <select
            value={String(cond.value || "")}
            onChange={(e) => updateCondition(index, { ...cond, value: e.target.value })}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-subtle)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          >
            <option value="">Select Epic...</option>
            {epics.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        );

      case "due_date":
        return (
          <input
            type="date"
            value={String(cond.value || "")}
            onChange={(e) => updateCondition(index, { ...cond, value: e.target.value })}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-subtle)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        );

      case "label":
      case "text":
      default:
        return (
          <input
            type="text"
            placeholder={cond.field === "label" ? "e.g. bug, frontend" : "Search query..."}
            value={String(cond.value || "")}
            onChange={(e) => updateCondition(index, { ...cond, value: e.target.value })}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-subtle)",
              color: "var(--text-primary)",
              outline: "none",
              minWidth: "140px",
            }}
          />
        );
    }
  };

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "14px 16px",
        marginBottom: "16px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: activeFilter.conditions.length > 0 ? "12px" : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <SlidersHorizontal size={15} color="var(--accent-primary)" />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
              Filter & Sort
            </span>
          </div>

          {/* AND / OR Segmented Toggle */}
          {activeFilter.conditions.length > 1 && (
            <div
              style={{
                display: "flex",
                backgroundColor: "var(--bg-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: "2px",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <button
                type="button"
                onClick={() => setOperator("AND")}
                style={{
                  padding: "2px 8px",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  backgroundColor:
                    activeFilter.operator === "AND" ? "var(--bg-surface)" : "transparent",
                  color:
                    activeFilter.operator === "AND"
                      ? "var(--accent-primary)"
                      : "var(--text-muted)",
                  boxShadow:
                    activeFilter.operator === "AND" ? "var(--shadow-sm)" : "none",
                  cursor: "pointer",
                }}
              >
                Match ALL (AND)
              </button>
              <button
                type="button"
                onClick={() => setOperator("OR")}
                style={{
                  padding: "2px 8px",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  backgroundColor:
                    activeFilter.operator === "OR" ? "var(--bg-surface)" : "transparent",
                  color:
                    activeFilter.operator === "OR"
                      ? "var(--accent-primary)"
                      : "var(--text-muted)",
                  boxShadow:
                    activeFilter.operator === "OR" ? "var(--shadow-sm)" : "none",
                  cursor: "pointer",
                }}
              >
                Match ANY (OR)
              </button>
            </div>
          )}
        </div>

        {/* Right side: Sort controls, Clear, Save Query */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Sort Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <ArrowUpDown size={12} color="var(--text-muted)" />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Sort:</span>
            <select
              value={activeSort.field}
              onChange={(e) =>
                setSort({
                  ...activeSort,
                  field: e.target.value as QuerySortOption["field"],
                })
              }
              style={{
                padding: "2px 6px",
                fontSize: "var(--text-xs)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-subtle)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            >
              {SORT_FIELDS.map((sf) => (
                <option key={sf.value} value={sf.value}>
                  {sf.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-ghost"
              style={{ height: "22px", padding: "0 5px", fontSize: "var(--text-xs)" }}
              onClick={() =>
                setSort({
                  ...activeSort,
                  direction: activeSort.direction === "ASC" ? "DESC" : "ASC",
                })
              }
              title={`Sort direction: ${activeSort.direction}`}
            >
              {activeSort.direction}
            </button>
          </div>

          {activeFilter.conditions.length > 0 && (
            <button
              type="button"
              className="btn-ghost"
              style={{ height: "24px", padding: "0 6px", fontSize: "var(--text-xs)", gap: "4px" }}
              onClick={clearConditions}
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}

          <button
            type="button"
            className="btn-ghost"
            style={{
              height: "24px",
              padding: "0 8px",
              fontSize: "var(--text-xs)",
              gap: "4px",
              color: "var(--accent-primary)",
            }}
            onClick={openSaveModal}
          >
            <Bookmark size={12} /> Save View...
          </button>
        </div>
      </div>

      {/* Filter Rows List */}
      {activeFilter.conditions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
          {activeFilter.conditions.map((cond, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "var(--bg-app)",
                padding: "6px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", minWidth: "40px" }}>
                {idx === 0 ? "Where" : activeFilter.operator.toLowerCase()}
              </span>

              {/* Field Select */}
              <select
                value={cond.field}
                onChange={(e) => handleFieldChange(idx, e.target.value as FilterField)}
                style={{
                  padding: "4px 8px",
                  fontSize: "12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-subtle)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              >
                {FIELD_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>

              {/* Operator Select */}
              <select
                value={cond.operator}
                onChange={(e) =>
                  updateCondition(idx, {
                    ...cond,
                    operator: e.target.value as FilterOperator,
                  })
                }
                style={{
                  padding: "4px 8px",
                  fontSize: "12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-subtle)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              >
                {OPERATOR_CONFIG[cond.field].map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              {/* Value Input */}
              {renderValueInput(cond, idx)}

              <button
                type="button"
                onClick={() => removeCondition(idx)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "3px",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                }}
                title="Remove condition"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer bar with + Add Condition and Execution Speed Badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          type="button"
          onClick={handleAddField}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "none",
            border: "none",
            color: "var(--accent-primary)",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            padding: "2px 4px",
          }}
        >
          <Plus size={13} /> Add Condition
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          <span>
            {totalCount} {totalCount === 1 ? "ticket" : "tickets"} found
          </span>
          <span>•</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{executionTimeMs}ms</span>
        </div>
      </div>
    </div>
  );
}
