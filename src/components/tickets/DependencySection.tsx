import React, { useState, useEffect, useCallback } from "react";
import { Plus, X, ArrowRight, ShieldAlert, GitPullRequest, Copy } from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import { AddLinkModal } from "./AddLinkModal";
import type { EnrichedDependency, DependencyRelationshipType } from "../../lib/tickets/dependencyService";

interface DependencySectionProps {
  ticketId: string;
}

const SECTION_CONFIG: Record<
  DependencyRelationshipType,
  { title: string; Icon: React.ComponentType<{ size?: number; color?: string }>; badgeColor: string }
> = {
  blocks: { title: "Blocks", Icon: ArrowRight, badgeColor: "#EF4444" },
  is_blocked_by: { title: "Blocked by", Icon: ShieldAlert, badgeColor: "#F59E0B" },
  relates_to: { title: "Relates to", Icon: GitPullRequest, badgeColor: "#3B82F6" },
  duplicates: { title: "Duplicates", Icon: Copy, badgeColor: "#8B5CF6" },
  is_duplicated_by: { title: "Duplicated by", Icon: Copy, badgeColor: "#8B5CF6" },
};

export function DependencySection({ ticketId }: DependencySectionProps) {
  const { getDependencies, unlinkTickets, openTicketDetail } = useTickets();
  const [dependencies, setDependencies] = useState<EnrichedDependency[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadDependencies = useCallback(() => {
    try {
      const deps = getDependencies(ticketId);
      setDependencies(deps);
    } catch (err) {
      console.error("Failed to load dependencies:", err);
    }
  }, [ticketId, getDependencies]);

  useEffect(() => {
    loadDependencies();
  }, [loadDependencies]);

  const handleUnlink = (linkId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    unlinkTickets(linkId);
    loadDependencies();
  };

  // Group dependencies by relationship type
  const grouped = dependencies.reduce((acc, dep) => {
    const key = dep.relationship_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(dep);
    return acc;
  }, {} as Partial<Record<DependencyRelationshipType, EnrichedDependency[]>>);

  const totalDeps = dependencies.length;

  return (
    <div style={{ marginTop: "20px" }}>
      {/* Header and Add Button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Dependencies {totalDeps > 0 && `(${totalDeps})`}
        </span>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: "none",
            border: "none",
            color: "var(--accent-primary)",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            padding: "2px 4px",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <Plus size={13} />
          Add Link
        </button>
      </div>

      {totalDeps === 0 ? (
        <div
          style={{
            padding: "12px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--bg-subtle)",
            color: "var(--text-muted)",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          No linked tickets
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(Object.keys(grouped) as DependencyRelationshipType[]).map((relType) => {
            const list = grouped[relType];
            if (!list || list.length === 0) return null;
            const config = SECTION_CONFIG[relType];
            const Icon = config.Icon;

            return (
              <div key={relType}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: config.badgeColor,
                    marginBottom: "4px",
                  }}
                >
                  <Icon size={12} color={config.badgeColor} />
                  <span>{config.title}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {list.map((dep) => (
                    <div
                      key={dep.id}
                      onClick={() => openTicketDetail(dep.target_ticket_id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-surface)",
                        cursor: "pointer",
                        transition: "all var(--transition-fast)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-hover)";
                        e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-subtle)";
                        e.currentTarget.style.backgroundColor = "var(--bg-surface)";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          overflow: "hidden",
                          flex: 1,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-xs)",
                            fontWeight: 600,
                            color: "var(--accent-primary)",
                            flexShrink: 0,
                          }}
                        >
                          {dep.target_ticket_identifier}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                          }}
                        >
                          {dep.target_ticket_title}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            fontWeight: 500,
                            padding: "1px 6px",
                            borderRadius: "var(--radius-full)",
                            backgroundColor: `${dep.target_workflow_state_color}22`,
                            color: dep.target_workflow_state_color,
                            flexShrink: 0,
                          }}
                        >
                          {dep.target_workflow_state_name}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleUnlink(dep.id, e)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: "3px",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                          borderRadius: "var(--radius-sm)",
                          display: "flex",
                          alignItems: "center",
                          marginLeft: "6px",
                          opacity: 0.6,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "var(--accent-red)";
                          e.currentTarget.style.opacity = "1";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--text-muted)";
                          e.currentTarget.style.opacity = "0.6";
                        }}
                        title="Remove link"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Link Modal */}
      <AddLinkModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        sourceTicketId={ticketId}
        onLinked={loadDependencies}
      />
    </div>
  );
}
