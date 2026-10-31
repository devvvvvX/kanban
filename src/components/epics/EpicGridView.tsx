import { useState, useMemo } from "react";
import { Milestone, Plus, Calendar, Edit2, Trash2, Layers } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { useTabs } from "../../context/TabContext";
import { NewEpicModal } from "./NewEpicModal";
import type { EpicRecord, EpicStatus } from "../../lib/projects/epicService";
import { useEscapeKey } from "../../hooks/useEscapeKey";

export function EpicGridView() {
  const { activeProject, epics, getEpicRollup, deleteEpic } = useProject();
  const { openEpicTab } = useTabs();

  const [selectedStatus, setSelectedStatus] = useState<EpicStatus | "all">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<EpicRecord | null>(null);
  const [deletingEpicId, setDeletingEpicId] = useState<string | null>(null);

  useEscapeKey(Boolean(deletingEpicId), () => setDeletingEpicId(null));

  const filteredEpics = useMemo(() => {
    if (selectedStatus === "all") return epics;
    return epics.filter((e) => e.status === selectedStatus);
  }, [epics, selectedStatus]);

  if (!activeProject) return null;

  const handleEdit = (epic: EpicRecord) => {
    setEditingEpic(epic);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingEpic(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteEpic(id);
    setDeletingEpicId(null);
  };

  return (
    <div style={{ padding: "var(--space-8)" }}>
      {/* Top Header & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
        <div>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>Epics & Milestones</h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: "2px" }}>
            Track progress and timelines across major initiatives in {activeProject.name}
          </p>
        </div>

        <button
          className="btn-primary"
          style={{ height: "34px", fontSize: "var(--text-sm)", gap: "6px" }}
          onClick={handleOpenCreate}
        >
          <Plus size={16} />
          <span>Create Epic</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-6)", overflowX: "auto" }}>
        {(["all", "planned", "in_progress", "completed", "cancelled"] as const).map((st) => {
          const isSelected = selectedStatus === st;
          const count = st === "all" ? epics.length : epics.filter((e) => e.status === st).length;
          return (
            <button
              key={st}
              className={`sidebar-item ${isSelected ? "active" : ""}`}
              style={{
                margin: 0,
                padding: "6px 12px",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-full)",
                fontSize: "var(--text-xs)",
                fontWeight: isSelected ? 600 : 500,
                backgroundColor: isSelected ? "var(--bg-surface-hover)" : "var(--bg-surface)",
                textTransform: "capitalize",
              }}
              onClick={() => setSelectedStatus(st)}
            >
              <span>{st.replace("_", " ")}</span>
              <span style={{ marginLeft: "4px", opacity: 0.6 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Epics Grid or Empty State */}
      {filteredEpics.length === 0 ? (
        <div
          style={{
            padding: "var(--space-12)",
            textAlign: "center",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px dashed var(--border-subtle)",
          }}
        >
          <Milestone size={40} color="var(--text-muted)" style={{ margin: "0 auto var(--space-3)" }} />
          <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>No Epics Found</h3>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "400px", margin: "var(--space-2) auto var(--space-6)" }}>
            {selectedStatus === "all"
              ? "Break your project into major milestones or feature epics with progress rollups."
              : `There are currently no epics with status "${selectedStatus.replace("_", " ")}".`}
          </p>
          <button className="btn-primary" onClick={handleOpenCreate}>
            <Plus size={15} /> Create Epic
          </button>
        </div>
      ) : (
        <div className="epic-grid">
          {filteredEpics.map((epic) => {
            const rollup = getEpicRollup(epic.id);
            const total = rollup?.totalTickets || 0;
            const completed = rollup?.completedTickets || 0;
            const progress = rollup?.progressPercentage || 0;

            return (
              <div
                key={epic.id}
                className="epic-card"
                onClick={() => openEpicTab(epic.id, epic.title)}
                style={{ cursor: "pointer", transition: "all var(--transition-fast)" }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span
                      className="project-dot"
                      style={{ backgroundColor: epic.color, width: "12px", height: "12px" }}
                    />
                    <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>
                      {epic.title}
                    </h3>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
                    <span className={`status-badge ${epic.status}`}>{epic.status.replace("_", " ")}</span>
                    <button
                      className="btn-ghost"
                      style={{ width: "24px", height: "24px" }}
                      onClick={() => handleEdit(epic)}
                      title="Edit Epic"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ width: "24px", height: "24px", color: "var(--color-danger)" }}
                      onClick={() => setDeletingEpicId(epic.id)}
                      title="Delete Epic"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {epic.description && (
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {epic.description}
                  </p>
                )}

                {/* Dates */}
                {(epic.start_date || epic.target_date) && (
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    <Calendar size={13} />
                    <span>
                      {epic.start_date || "Anytime"} → {epic.target_date || "No deadline"}
                    </span>
                  </div>
                )}

                {/* Progress Rollup */}
                <div style={{ marginTop: "auto", paddingTop: "var(--space-2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "4px" }}>
                    <span>Progress</span>
                    <span>
                      {completed}/{total} tickets ({progress}%)
                    </span>
                  </div>
                  <div className="progress-track" style={{ marginBottom: "8px" }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: epic.color,
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
                    <button
                      className="btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEpicTab(epic.id, epic.title);
                      }}
                      style={{ height: "26px", fontSize: "var(--text-xs)", gap: "5px", padding: "0 8px" }}
                    >
                      <Layers size={12} />
                      <span>View Tickets ({total})</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New / Edit Epic Modal */}
      <NewEpicModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        epicToEdit={editingEpic}
      />

      {/* Delete Confirmation Modal */}
      {deletingEpicId && (
        <div className="modal-overlay" onClick={() => setDeletingEpicId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--color-danger)", marginBottom: "var(--space-2)" }}>
              Delete Epic
            </h3>
            <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
              Are you sure you want to delete this epic? Any tickets assigned to this epic will remain in the project.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
              <button className="btn-secondary" onClick={() => setDeletingEpicId(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ backgroundColor: "var(--color-danger)", borderColor: "var(--color-danger)" }}
                onClick={() => handleDelete(deletingEpicId)}
              >
                Delete Epic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
