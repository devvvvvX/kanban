import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Palette,
  Shield,
  Database,
  Bot,
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Maximize2,
  Minimize2,
  LogOut,
  FolderOpen,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Globe,
  Bell,
  Volume2,
  VolumeX,
  Play,
} from "lucide-react";
import { McpSettingsPanel } from "./McpSettingsPanel";
import { useAuth } from "../../context/AuthContext";
import { useProject } from "../../context/ProjectContext";
import { useTickets } from "../../context/TicketContext";
import { useQuery } from "../../context/QueryContext";
import { BackupService, type ValidationResult } from "../../lib/backup/backupService";
import { DatabaseResetService } from "../../lib/db/resetService";
import { DatabasePersistenceService, type DatabaseStorageInfo } from "../../lib/db/persistenceService";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { getLinkOpenTarget, setLinkOpenTarget, type LinkOpenTarget } from "../../utils/linkHandler";
import {
  NOTIFICATION_SOUNDS,
  getNotificationSoundEnabled,
  setNotificationSoundEnabled,
  getContinuousRingEnabled,
  setContinuousRingEnabled,
  stopContinuousRing,
  isContinuousRingActive,
  getSelectedNotificationSound,
  setSelectedNotificationSound,
  playNotificationSound,
  type NotificationSound,
} from "../../utils/soundEffects";
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendDesktopNotification,
  isTauriEnvironment,
} from "../../utils/notifications";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMcpSettings?: () => void;
}

type SettingsTab = "appearance" | "defaults" | "notifications" | "mcp" | "security" | "backup";

export interface CanvasGradientOption {
  id: string;
  label: string;
  desc: string;
  color: string;
  appearance: "light" | "dark" | null;
}

export const CANVAS_GRADIENT_OPTIONS: CanvasGradientOption[] = [
  { id: "default", label: "Default Solid", desc: "Native flat canvas", color: "var(--bg-app)", appearance: null },

  // Light & Fresh Eye-Comfort Tints
  { id: "warm-sand", label: "Warm Sand", desc: "Amber paper warmth", color: "#F5EFE6", appearance: "light" },
  { id: "soft-slate", label: "Soft Slate", desc: "Morning slate mist", color: "#EBF0F5", appearance: "light" },
  { id: "light-blue", label: "Light Blue", desc: "Sky azure serenity", color: "#E6F0FA", appearance: "light" },
  { id: "light-green", label: "Light Green", desc: "Calm mint sage", color: "#EAF6EE", appearance: "light" },
  { id: "magenta", label: "Magenta Blossom", desc: "Blush rose quartz", color: "#FBEBF3", appearance: "light" },
  { id: "aurora-mist", label: "Aurora Mist", desc: "Soothing pastel sage", color: "#EBF5F2", appearance: "light" },
  { id: "lavender-dusk", label: "Lavender Dusk", desc: "Twilight lilac calm", color: "#EFEAF6", appearance: "light" },
  { id: "sunset-glow", label: "Sunset Glow", desc: "Gentle peach warmth", color: "#FBF0EB", appearance: "light" },

  // Dark & Deep Nocturnes
  { id: "dark-obsidian", label: "Dark Obsidian", desc: "Midnight charcoal", color: "#0A0D12", appearance: "dark" },
  { id: "navy-blue", label: "Navy Blue", desc: "Maritime ocean depth", color: "#070D18", appearance: "dark" },
  { id: "dark-emerald", label: "Dark Emerald", desc: "Nocturnal spruce pine", color: "#06130D", appearance: "dark" },
  { id: "dark-magenta", label: "Dark Magenta", desc: "Velvet midnight plum", color: "#130715", appearance: "dark" },
  { id: "deep-indigo", label: "Deep Indigo", desc: "Cosmic slate indigo", color: "#0A0D1A", appearance: "dark" },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenMcpSettings,
}) => {
  useEscapeKey(isOpen, onClose);
  void onOpenMcpSettings;

  const { user, theme, setTheme, logout } = useAuth();
  const { projects, refreshProjects } = useProject();
  const { tickets, refreshTickets, refreshStates } = useTickets();
  const { savedQueries, refreshSavedQueries } = useQuery();

  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [linkTarget, setLinkTarget] = useState<LinkOpenTarget>("tab");

  // Eye-comfort gradient canvas tints
  const [gradientPreference, setGradientPreferenceState] = useState<string>(() => {
    try {
      return localStorage.getItem("kanban_gradient_preference") || "default";
    } catch {}
    return "default";
  });

  const handleGradientChange = (grad: string) => {
    setGradientPreferenceState(grad);
    try {
      localStorage.setItem("kanban_gradient_preference", grad);
    } catch {}
    if (grad === "default") {
      document.documentElement.removeAttribute("data-gradient");
      document.documentElement.removeAttribute("data-canvas-gradient");
    } else {
      document.documentElement.setAttribute("data-gradient", grad);
      document.documentElement.setAttribute("data-canvas-gradient", grad);
    }

    // Automatically balance appearance to match the chosen gradient
    const opt = CANVAS_GRADIENT_OPTIONS.find((g) => g.id === grad);
    if (opt && opt.appearance) {
      setTheme(opt.appearance);
    }
  };

  // Configurable Default '+' Action
  const [defaultPlusAction, setDefaultPlusActionState] = useState<string>(() => {
    try {
      return localStorage.getItem("kanban_default_plus_action") || "ticket";
    } catch {}
    return "ticket";
  });

  const handlePlusActionChange = (action: string) => {
    setDefaultPlusActionState(action);
    try {
      localStorage.setItem("kanban_default_plus_action", action);
    } catch {}
  };

  // Notifications & Sound states
  const [soundEnabled, setSoundEnabled] = useState(getNotificationSoundEnabled());
  const [selectedSound, setSelectedSound] = useState<NotificationSound>(getSelectedNotificationSound());
  const [continuousRingEnabled, setContinuousRingEnabledState] = useState(getContinuousRingEnabled());
  const [isRinging, setIsRinging] = useState(isContinuousRingActive());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(getNotificationPermission());
  const [testSentMessage, setTestSentMessage] = useState(false);

  useEffect(() => {
    setIsRinging(isContinuousRingActive());
    const handleRing = (e: Event) => {
      const customEvent = e as CustomEvent<{ ringing: boolean }>;
      if (customEvent.detail) {
        setIsRinging(Boolean(customEvent.detail.ringing));
      }
    };
    window.addEventListener("kanban:ring-state-changed", handleRing);
    return () => window.removeEventListener("kanban:ring-state-changed", handleRing);
  }, []);

  // Backup / Restore states
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [restoreValidation, setRestoreValidation] = useState<ValidationResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [confirmReplaceText, setConfirmReplaceText] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sqliteFileInputRef = useRef<HTMLInputElement>(null);

  // Local Database Persistence & Reset states
  const [storageInfo, setStorageInfo] = useState<DatabaseStorageInfo | null>(null);
  const [copiedDbPath, setCopiedDbPath] = useState(false);
  const [resetDataText, setResetDataText] = useState("");
  const [isResettingData, setIsResettingData] = useState(false);
  const [resetDataSuccess, setResetDataSuccess] = useState<string | null>(null);
  const [resetDataError, setResetDataError] = useState<string | null>(null);

  const [purgeText, setPurgeText] = useState("");
  const [deleteDiskOnPurge, setDeleteDiskOnPurge] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const [rawSqliteSuccess, setRawSqliteSuccess] = useState<string | null>(null);
  const [rawSqliteError, setRawSqliteError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === "backup") {
      const persistenceService = new DatabasePersistenceService();
      persistenceService.getStorageInfo().then(setStorageInfo).catch(console.error);
    }
  }, [isOpen, activeTab]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedDensity = localStorage.getItem("kanban_density");
      if (savedDensity === "compact" || savedDensity === "comfortable") {
        setDensity(savedDensity);
        document.documentElement.setAttribute("data-density", savedDensity);
      }

      const savedMotion = localStorage.getItem("kanban_reduced_motion") === "true";
      setReducedMotion(savedMotion);
      document.documentElement.setAttribute("data-reduced-motion", String(savedMotion));

      setLinkTarget(getLinkOpenTarget());
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleDensityChange = (newDensity: "comfortable" | "compact") => {
    setDensity(newDensity);
    localStorage.setItem("kanban_density", newDensity);
    document.documentElement.setAttribute("data-density", newDensity);
  };

  const handleMotionChange = (enabled: boolean) => {
    setReducedMotion(enabled);
    localStorage.setItem("kanban_reduced_motion", String(enabled));
    document.documentElement.setAttribute("data-reduced-motion", String(enabled));
  };

  const handleLinkTargetChange = (target: LinkOpenTarget) => {
    setLinkTarget(target);
    setLinkOpenTarget(target);
  };

  if (!isOpen) return null;

  // Export workspace to downloadable JSON
  const handleExportBackup = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const backupService = new BackupService();
      const payload = await backupService.exportWorkspace(user.id);
      const jsonStr = JSON.stringify(payload, null, 2);

      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `kanban-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error("Backup export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Inspect and validate backup file
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreError(null);
    setRestoreSuccess(null);
    setRestoreValidation(null);

    try {
      const text = await file.text();
      const backupService = new BackupService();
      const validation = await backupService.validateBackup(text);

      if (!validation.valid) {
        setRestoreError(validation.error || "Backup validation failed.");
      } else {
        setRestoreValidation(validation);
      }
    } catch (err: any) {
      setRestoreError(`Failed to read file: ${err.message || String(err)}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Execute restore
  const handleExecuteRestore = async () => {
    if (!user || !restoreValidation?.valid || !restoreValidation.payload) return;

    if (restoreMode === "replace" && confirmReplaceText.trim() !== "RESTORE") {
      setRestoreError("Please type 'RESTORE' to confirm workspace replacement.");
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);

    try {
      const backupService = new BackupService();
      await backupService.restoreWorkspace(user.id, restoreValidation.payload, restoreMode);

      refreshProjects();
      refreshTickets();
      refreshStates();
      refreshSavedQueries();

      setRestoreSuccess(
        `Successfully restored ${restoreValidation.stats?.tickets || 0} tickets across ${restoreValidation.stats?.projects || 0} projects in ${restoreMode} mode!`
      );
      setRestoreValidation(null);
      setConfirmReplaceText("");
    } catch (err: any) {
      setRestoreError(`Restore execution failed: ${err.message || String(err)}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCopyDbPath = () => {
    if (storageInfo?.databasePath) {
      navigator.clipboard.writeText(storageInfo.databasePath);
      setCopiedDbPath(true);
      setTimeout(() => setCopiedDbPath(false), 2000);
    }
  };

  const handleShowInFinder = async () => {
    const persistenceService = new DatabasePersistenceService();
    await persistenceService.showInFinder();
  };

  const handleExportRawSqlite = () => {
    try {
      const persistenceService = new DatabasePersistenceService();
      persistenceService.exportSqliteDatabase();
      setRawSqliteSuccess("Raw SQLite database exported!");
      setTimeout(() => setRawSqliteSuccess(null), 3000);
    } catch (err: any) {
      setRawSqliteError(`Export failed: ${err.message}`);
    }
  };

  const handleImportRawSqlite = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawSqliteError(null);
    setRawSqliteSuccess(null);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const persistenceService = new DatabasePersistenceService();
      const res = await persistenceService.importSqliteDatabase(bytes);
      refreshProjects();
      refreshTickets();
      refreshStates();
      refreshSavedQueries();
      const info = await persistenceService.getStorageInfo();
      setStorageInfo(info);
      setRawSqliteSuccess(`Successfully loaded raw SQLite database (Schema v${res.version})!`);
      setTimeout(() => setRawSqliteSuccess(null), 4000);
    } catch (err: any) {
      setRawSqliteError(`SQLite Import failed: ${err.message}`);
    } finally {
      if (sqliteFileInputRef.current) sqliteFileInputRef.current.value = "";
    }
  };

  const handleResetWorkspaceData = async () => {
    if (resetDataText.trim() !== "RESET DATA") {
      setResetDataError("Please type 'RESET DATA' to confirm cleaning database data.");
      return;
    }
    setIsResettingData(true);
    setResetDataError(null);
    try {
      const resetService = new DatabaseResetService();
      const result = await resetService.resetWorkspaceData();
      refreshProjects();
      refreshTickets();
      refreshStates();
      refreshSavedQueries();
      setResetDataSuccess(result.message);
      setResetDataText("");
      setTimeout(() => setResetDataSuccess(null), 5000);
    } catch (err: any) {
      setResetDataError(`Reset failed: ${err.message}`);
    } finally {
      setIsResettingData(false);
    }
  };

  const handleFullFactoryReset = async () => {
    if (purgeText.trim() !== "PURGE ALL") {
      setPurgeError("Please type 'PURGE ALL' to confirm deleting everything.");
      return;
    }
    setIsPurging(true);
    setPurgeError(null);
    try {
      const resetService = new DatabaseResetService();
      await resetService.fullFactoryReset({ deleteDiskFile: deleteDiskOnPurge });
      onClose();
      window.location.reload();
    } catch (err: any) {
      setPurgeError(`Purge failed: ${err.message}`);
      setIsPurging(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-modal-header">
          <div className="modal-header-left">
            <span className="modal-title">Preferences</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="settings-modal-close-btn"
            className="btn-ghost"
            style={{ width: 24, height: 24, padding: 0 }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body Container (Tab Strip + Content Panel) */}
        <div className="settings-modal-body">
          {/* Tab Sidebar - Unified macOS Sonoma/Sequoia Preferences Navigation */}
          <div className="settings-tab-sidebar" data-testid="settings-tab-sidebar">
            <div className="settings-tab-category">General</div>
            <button
              type="button"
              onClick={() => setActiveTab("appearance")}
              className={`settings-tab-btn ${activeTab === "appearance" ? "active" : ""}`}
              data-testid="settings-tab-appearance"
            >
              <Palette size={15} color={activeTab === "appearance" ? "#FFFFFF" : "var(--accent-blue)"} />
              <span>Appearance</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("defaults")}
              className={`settings-tab-btn ${activeTab === "defaults" ? "active" : ""}`}
              data-testid="settings-tab-defaults"
            >
              <Globe size={15} color={activeTab === "defaults" ? "#FFFFFF" : "#10B981"} />
              <span>Workspace Defaults</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("notifications")}
              className={`settings-tab-btn ${activeTab === "notifications" ? "active" : ""}`}
              data-testid="settings-tab-notifications"
            >
              <Bell size={15} color={activeTab === "notifications" ? "#FFFFFF" : "#F59E0B"} />
              <span>Notifications</span>
            </button>

            <div className="settings-tab-category">Integrations</div>
            <button
              type="button"
              onClick={() => setActiveTab("mcp")}
              className={`settings-tab-btn ${activeTab === "mcp" ? "active" : ""}`}
              data-testid="settings-tab-mcp"
            >
              <Bot size={15} color={activeTab === "mcp" ? "#FFFFFF" : "#10B981"} />
              <span>MCP Agent</span>
            </button>

            <div className="settings-tab-category">System &amp; Data</div>
            <button
              type="button"
              onClick={() => setActiveTab("security")}
              className={`settings-tab-btn ${activeTab === "security" ? "active" : ""}`}
              data-testid="settings-tab-security"
            >
              <Shield size={15} color={activeTab === "security" ? "#FFFFFF" : "#8B5CF6"} />
              <span>Security</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("backup")}
              className={`settings-tab-btn ${activeTab === "backup" ? "active" : ""}`}
              data-testid="settings-tab-backup"
            >
              <Database size={15} color={activeTab === "backup" ? "#FFFFFF" : "var(--accent-blue)"} />
              <span>Backup &amp; Restore</span>
            </button>
          </div>

          {/* Active Tab Content Panel */}
          <div className="settings-content-panel">
            {/* 1. Appearance Tab */}
            {activeTab === "appearance" && (
              <div className="settings-section">
                <div className="settings-group">
                  <h3 className="settings-group-title">Theme &amp; Appearance</h3>
                  <p className="settings-group-desc">
                    Select your visual appearance or synchronize with macOS system settings.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                    <button
                      onClick={() => setTheme("dark")}
                      style={{
                        padding: "var(--space-3)",
                        borderRadius: "var(--radius-lg)",
                        border: `1px solid ${theme === "dark" ? "var(--accent-blue)" : "var(--border-default)"}`,
                        backgroundColor: theme === "dark" ? "var(--accent-blue-subtle)" : "var(--bg-surface)",
                        color: "var(--text-primary)",
                        fontFamily: "inherit",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                        transition: "all var(--transition-fast)",
                      }}
                    >
                      <Moon size={18} color={theme === "dark" ? "var(--accent-blue)" : "var(--text-secondary)"} />
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 500 }}>Dark</span>
                    </button>

                    <button
                      onClick={() => setTheme("light")}
                      style={{
                        padding: "var(--space-3)",
                        borderRadius: "var(--radius-lg)",
                        border: `1px solid ${theme === "light" ? "var(--accent-blue)" : "var(--border-default)"}`,
                        backgroundColor: theme === "light" ? "var(--accent-blue-subtle)" : "var(--bg-surface)",
                        color: "var(--text-primary)",
                        fontFamily: "inherit",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                        transition: "all var(--transition-fast)",
                      }}
                    >
                      <Sun size={18} color={theme === "light" ? "var(--accent-blue)" : "var(--text-secondary)"} />
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 500 }}>Light</span>
                    </button>

                    <button
                      onClick={() => setTheme("system")}
                      style={{
                        padding: "var(--space-3)",
                        borderRadius: "var(--radius-lg)",
                        border: `1px solid ${theme === "system" ? "var(--accent-blue)" : "var(--border-default)"}`,
                        backgroundColor: theme === "system" ? "var(--accent-blue-subtle)" : "var(--bg-surface)",
                        color: "var(--text-primary)",
                        fontFamily: "inherit",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                        transition: "all var(--transition-fast)",
                      }}
                    >
                      <Monitor size={18} color={theme === "system" ? "var(--accent-blue)" : "var(--text-secondary)"} />
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 500 }}>Auto (System)</span>
                    </button>
                  </div>
                </div>

                {/* Eye-Comfort Gradients & Canvas Tints */}
                <div className="settings-group" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
                  <h3 className="settings-group-title">Eye-Comfort Gradients &amp; Canvas Tint</h3>
                  <p className="settings-group-desc">
                    Replaces harsh blinding white with warm paper, calm slate, ocean azure, mint sage, and soothing dark nocturnes. Changing a tint automatically balances the appearance mode.
                  </p>

                  {/* Light & Fresh Tints */}
                  <div style={{ marginTop: "var(--space-3)" }}>
                    <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Light &amp; Calm Tints (Daylight Ergonomics)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                      {CANVAS_GRADIENT_OPTIONS.filter((g) => g.appearance === "light" || g.id === "default").map((grad) => {
                        const isSelected = gradientPreference === grad.id;
                        return (
                          <button
                            key={grad.id}
                            type="button"
                            data-testid={`gradient-option-${grad.id}`}
                            onClick={() => handleGradientChange(grad.id)}
                            style={{
                              padding: "10px",
                              borderRadius: "var(--radius-lg)",
                              border: `2px solid ${isSelected ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                              backgroundColor: "var(--bg-surface)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                              gap: 6,
                              cursor: "pointer",
                              transition: "all var(--transition-fast)",
                              textAlign: "left",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                              <span
                                style={{
                                  width: 14,
                                  height: 14,
                                  borderRadius: "50%",
                                  backgroundColor: grad.color,
                                  border: "1px solid var(--border-default)",
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>
                                {grad.label}
                              </span>
                            </div>
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.3 }}>
                              {grad.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dark & Deep Nocturnes */}
                  <div style={{ marginTop: "var(--space-4)" }}>
                    <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Dark &amp; Nocturne Tints (Night-Shift Focus)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                      {CANVAS_GRADIENT_OPTIONS.filter((g) => g.appearance === "dark").map((grad) => {
                        const isSelected = gradientPreference === grad.id;
                        return (
                          <button
                            key={grad.id}
                            type="button"
                            data-testid={`gradient-option-${grad.id}`}
                            onClick={() => handleGradientChange(grad.id)}
                            style={{
                              padding: "10px",
                              borderRadius: "var(--radius-lg)",
                              border: `2px solid ${isSelected ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                              backgroundColor: "var(--bg-surface)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                              gap: 6,
                              cursor: "pointer",
                              transition: "all var(--transition-fast)",
                              textAlign: "left",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                              <span
                                style={{
                                  width: 14,
                                  height: 14,
                                  borderRadius: "50%",
                                  backgroundColor: grad.color,
                                  border: "1px solid var(--border-default)",
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>
                                {grad.label}
                              </span>
                            </div>
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.3 }}>
                              {grad.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="settings-group" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
                  <h3 className="settings-group-title">Interface Density (SETT-01)</h3>
                  <p className="settings-group-desc">
                    Adjust spacing and information density across Kanban boards and lists.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                    <button
                      onClick={() => handleDensityChange("comfortable")}
                      style={{
                        padding: "var(--space-3)",
                        borderRadius: "var(--radius-lg)",
                        border: `1px solid ${density === "comfortable" ? "var(--accent-blue)" : "var(--border-default)"}`,
                        backgroundColor: density === "comfortable" ? "var(--accent-blue-subtle)" : "var(--bg-surface)",
                        color: "var(--text-primary)",
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all var(--transition-fast)",
                      }}
                    >
                      <Maximize2 size={16} color={density === "comfortable" ? "var(--accent-blue)" : "var(--text-secondary)"} />
                      <div>
                        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>Comfortable</div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Default breathing room</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleDensityChange("compact")}
                      style={{
                        padding: "var(--space-3)",
                        borderRadius: "var(--radius-lg)",
                        border: `1px solid ${density === "compact" ? "var(--accent-blue)" : "var(--border-default)"}`,
                        backgroundColor: density === "compact" ? "var(--accent-blue-subtle)" : "var(--bg-surface)",
                        color: "var(--text-primary)",
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all var(--transition-fast)",
                      }}
                    >
                      <Minimize2 size={16} color={density === "compact" ? "var(--accent-blue)" : "var(--text-secondary)"} />
                      <div>
                        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>Compact</div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>High-density engineer mode</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="settings-group" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div className="settings-group-title">Reduced Motion</div>
                      <div className="settings-group-desc">
                        Disable slide animations and drawer transitions for maximum speed.
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={reducedMotion}
                      onChange={(e) => handleMotionChange(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--accent-blue)" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. Security Tab */}
            {activeTab === "security" && (
              <div className="settings-section">
                <div className="settings-group">
                  <h3 className="settings-group-title">Account Profile</h3>
                  <div
                    style={{
                      padding: "var(--space-4)",
                      backgroundColor: "var(--bg-app)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-2)",
                      marginTop: "var(--space-2)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)" }}>
                      <span style={{ color: "var(--text-muted)" }}>Display Name:</span>
                      <span style={{ fontWeight: 600 }}>{user?.display_name || "Guest"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)" }}>
                      <span style={{ color: "var(--text-muted)" }}>Email Account:</span>
                      <span style={{ fontFamily: "var(--font-mono)" }}>{user?.email || "none"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)" }}>
                      <span style={{ color: "var(--text-muted)" }}>Account Status:</span>
                      <span style={{ color: "var(--color-success)", fontWeight: 600 }}>Active (Offline Verified)</span>
                    </div>
                  </div>
                </div>

                <div className="settings-group" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
                  <h3 className="settings-group-title">Cryptographic Recovery Key</h3>
                  <p className="settings-group-desc">
                    Your high-entropy 256-bit recovery key is required if you ever forget your local password.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                    <Lock size={14} color="var(--color-success)" />
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success)", fontWeight: 500 }}>
                      Recovery Key Confirmed &amp; Active
                    </span>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
                  <button
                    onClick={() => {
                      onClose();
                      logout();
                    }}
                    className="btn-danger"
                    style={{ height: 32, padding: "0 14px", fontSize: "var(--text-xs)", gap: 6 }}
                  >
                    <LogOut size={13} />
                    <span>Sign Out of Account</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. Backup/Restore Tab */}
            {activeTab === "backup" && (
              <div className="settings-section">
                {/* 3.1 Local SQLite Database Persistence */}
                <div className="settings-group">
                  <h3 className="settings-group-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Database size={15} color="var(--accent-blue)" />
                    <span>Local Database Storage &amp; Persistence</span>
                  </h3>
                  <p className="settings-group-desc">
                    Your SQLite database is stored locally on this Mac. Because the file is kept in macOS Application Support, deleting, updating, or reinstalling <code>Kanban.app</code> safely preserves your accounts, passwords, sessions, and project data.
                  </p>

                  <div
                    style={{
                      padding: "var(--space-3) var(--space-4)",
                      backgroundColor: "var(--bg-app)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-3)",
                      marginTop: "var(--space-2)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Storage Type
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--color-success)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <CheckCircle2 size={12} />
                          <span>{storageInfo?.storageType || "macOS Persistent Storage"}</span>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Database Size
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                          {storageInfo?.sizeBytes ? `${(storageInfo.sizeBytes / 1024).toFixed(1)} KB` : "Active"}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                        Local File Path
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: "var(--bg-surface)",
                          border: "1px solid var(--border-default)",
                          borderRadius: "var(--radius-sm)",
                          padding: "4px 8px",
                        }}
                      >
                        <code style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {storageInfo?.databasePath || "~/Library/Application Support/com.kanban.macos/kanban.db"}
                        </code>
                        <button
                          onClick={handleCopyDbPath}
                          className="btn-ghost"
                          style={{ height: 24, padding: "0 6px", fontSize: "var(--text-xs)", gap: 4 }}
                          title="Copy Path"
                        >
                          {copiedDbPath ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
                          <span>{copiedDbPath ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-3)" }}>
                      <button
                        onClick={handleShowInFinder}
                        className="btn-secondary"
                        style={{ height: 28, padding: "0 10px", fontSize: "var(--text-xs)", gap: 5 }}
                      >
                        <FolderOpen size={12} />
                        <span>Reveal in Finder</span>
                      </button>

                      <button
                        onClick={handleExportRawSqlite}
                        className="btn-secondary"
                        style={{ height: 28, padding: "0 10px", fontSize: "var(--text-xs)", gap: 5 }}
                      >
                        <Download size={12} />
                        <span>Export Database (.sqlite)</span>
                      </button>

                      <input
                        type="file"
                        ref={sqliteFileInputRef}
                        accept=".sqlite,.db"
                        onChange={handleImportRawSqlite}
                        style={{ display: "none" }}
                      />

                      <button
                        onClick={() => sqliteFileInputRef.current?.click()}
                        className="btn-secondary"
                        style={{ height: 28, padding: "0 10px", fontSize: "var(--text-xs)", gap: 5 }}
                      >
                        <Upload size={12} />
                        <span>Import Database (.sqlite)...</span>
                      </button>
                    </div>

                    {rawSqliteSuccess && (
                      <div className="modal-error-alert" style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", borderColor: "var(--color-success)", color: "var(--color-success)" }}>
                        <CheckCircle2 size={13} />
                        <span>{rawSqliteSuccess}</span>
                      </div>
                    )}

                    {rawSqliteError && (
                      <div className="modal-error-alert">
                        <AlertTriangle size={13} />
                        <span>{rawSqliteError}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3.2 JSON Workspace Export */}
                <div className="settings-group" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
                  <h3 className="settings-group-title">Export Full Workspace (SETT-02)</h3>
                  <p className="settings-group-desc">
                    Exports all projects, epics, workflow states, tickets, subtasks, dependencies, comments, and saved queries to a portable versioned JSON file with cryptographic SHA-256 checksum integrity.
                  </p>

                  <div
                    style={{
                      padding: "var(--space-3) var(--space-4)",
                      backgroundColor: "var(--bg-app)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "var(--space-2)",
                    }}
                  >
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                      <strong>{projects.length}</strong> Projects • <strong>{tickets.length}</strong> Tickets • <strong>{savedQueries.length}</strong> Saved Queries
                    </div>

                    <button
                      onClick={handleExportBackup}
                      disabled={isExporting}
                      className="btn-primary"
                      style={{ height: 30, padding: "0 12px", fontSize: "var(--text-xs)", gap: 6 }}
                    >
                      {exportSuccess ? <CheckCircle2 size={13} /> : <Download size={13} />}
                      <span>{isExporting ? "Exporting..." : exportSuccess ? "Downloaded!" : "Export Backup (JSON)"}</span>
                    </button>
                  </div>
                </div>

                {/* 3.3 JSON Workspace Restore */}
                <div className="settings-group" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
                  <h3 className="settings-group-title">Restore Workspace from Backup (SETT-03)</h3>
                  <p className="settings-group-desc">
                    Restore projects and tasks from a previous JSON backup file. The backup integrity checksum will be strictly verified prior to applying any database changes.
                  </p>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                  />

                  <div style={{ marginTop: "var(--space-2)" }}>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-secondary"
                      style={{ height: 32, padding: "0 14px", fontSize: "var(--text-xs)", gap: 6 }}
                    >
                      <Upload size={13} />
                      <span>Select Backup File (.json)...</span>
                    </button>
                  </div>

                  {/* Restore Success Banner */}
                  {restoreSuccess && (
                    <div className="modal-error-alert" style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", borderColor: "var(--color-success)", color: "var(--color-success)", marginTop: "var(--space-3)" }}>
                      <CheckCircle2 size={14} />
                      <span>{restoreSuccess}</span>
                    </div>
                  )}

                  {/* Restore Error Banner */}
                  {restoreError && (
                    <div className="modal-error-alert" style={{ marginTop: "var(--space-3)" }}>
                      <AlertTriangle size={14} />
                      <span>{restoreError}</span>
                    </div>
                  )}

                  {/* Validation Preview Card */}
                  {restoreValidation?.valid && (
                    <div
                      style={{
                        padding: "var(--space-4)",
                        backgroundColor: "var(--bg-app)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "var(--radius-lg)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-3)",
                        marginTop: "var(--space-3)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-success)", fontSize: "var(--text-xs)", fontWeight: 600 }}>
                        <CheckCircle2 size={14} />
                        <span>Backup Validated • SHA-256 Checksum Verified</span>
                      </div>

                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                        Payload contains: {restoreValidation.stats?.projects} projects, {restoreValidation.stats?.tickets} tickets, {restoreValidation.stats?.workflowStates} columns, {restoreValidation.stats?.savedQueries} saved queries.
                      </div>

                      {/* Restore Mode Radios */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-2)" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", cursor: "pointer" }}>
                          <input
                            type="radio"
                            name="restoreMode"
                            checked={restoreMode === "merge"}
                            onChange={() => setRestoreMode("merge")}
                            style={{ accentColor: "var(--accent-blue)" }}
                          />
                          <span>
                            <strong>Merge (Recommended):</strong> Add imported projects and tickets alongside existing workspace.
                          </span>
                        </label>

                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", cursor: "pointer", color: "var(--color-danger)" }}>
                          <input
                            type="radio"
                            name="restoreMode"
                            checked={restoreMode === "replace"}
                            onChange={() => setRestoreMode("replace")}
                            style={{ accentColor: "var(--color-danger)" }}
                          />
                          <span>
                            <strong>Replace (Destructive):</strong> Purge current workspace and replace with backup snapshot.
                          </span>
                        </label>
                      </div>

                      {/* Replace safety prompt */}
                      {restoreMode === "replace" && (
                        <div style={{ padding: "var(--space-2)", backgroundColor: "var(--color-danger-subtle)", borderRadius: "var(--radius-sm)" }}>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", marginBottom: 4 }}>
                            Type <strong>RESTORE</strong> to confirm replacing active data:
                          </div>
                          <input
                            type="text"
                            value={confirmReplaceText}
                            onChange={(e) => setConfirmReplaceText(e.target.value)}
                            placeholder="RESTORE"
                            className="modal-input"
                            style={{ height: 28, fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}
                          />
                        </div>
                      )}

                      <button
                        onClick={handleExecuteRestore}
                        disabled={isRestoring}
                        className={restoreMode === "replace" ? "btn-danger" : "btn-primary"}
                        style={{ height: 32, fontSize: "var(--text-xs)", marginTop: "var(--space-2)" }}
                      >
                        {isRestoring ? "Restoring..." : `Confirm ${restoreMode === "replace" ? "Replace" : "Merge"} Restore`}
                      </button>
                    </div>
                  )}
                </div>

                {/* 3.4 Danger Zone & Reset Options */}
                <div className="settings-group" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
                  <h3 className="settings-group-title" style={{ color: "var(--color-danger)", display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={15} />
                    <span>Danger Zone &amp; Factory Reset</span>
                  </h3>
                  <p className="settings-group-desc">
                    Manage data cleanup options for local development or fresh starts.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                    {/* Reset Option A: Clean Data & Keep Users */}
                    <div
                      style={{
                        padding: "var(--space-4)",
                        backgroundColor: "var(--bg-app)",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border-default)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                      }}
                    >
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>
                        Reset Workspace Data (Keep Users &amp; Accounts)
                      </div>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.5 }}>
                        Cleans all tickets, epics, projects, workflow states, comments, activity events, and saved queries. <strong>Preserves all user accounts, passwords, sessions, and recovery verifiers</strong>. Re-initializes a fresh default project for your account.
                      </p>

                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: 4 }}>
                        <input
                          type="text"
                          value={resetDataText}
                          onChange={(e) => setResetDataText(e.target.value)}
                          placeholder="Type 'RESET DATA'"
                          className="modal-input"
                          style={{ flex: 1, height: 30, fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}
                        />
                        <button
                          onClick={handleResetWorkspaceData}
                          disabled={isResettingData || resetDataText.trim() !== "RESET DATA"}
                          className="btn-danger"
                          style={{ height: 30, padding: "0 12px", fontSize: "var(--text-xs)", gap: 6 }}
                        >
                          <RefreshCw size={12} className={isResettingData ? "spin-animation" : ""} />
                          <span>{isResettingData ? "Cleaning..." : "Reset Data"}</span>
                        </button>
                      </div>

                      {resetDataSuccess && (
                        <div className="modal-error-alert" style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", borderColor: "var(--color-success)", color: "var(--color-success)" }}>
                          <CheckCircle2 size={13} />
                          <span>{resetDataSuccess}</span>
                        </div>
                      )}

                      {resetDataError && (
                        <div className="modal-error-alert">
                          <AlertTriangle size={13} />
                          <span>{resetDataError}</span>
                        </div>
                      )}
                    </div>

                    {/* Reset Option B: Full Factory Purge */}
                    <div
                      style={{
                        padding: "var(--space-4)",
                        backgroundColor: "var(--color-danger-subtle)",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--color-danger)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                      }}
                    >
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-danger)" }}>
                        Full Factory Reset (Purge Everything)
                      </div>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.5 }}>
                        Permanently deletes all data including all user accounts, login credentials, sessions, and recovery verifiers. Returns the application to an uninitialized factory state.
                      </p>

                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", color: "var(--text-secondary)", cursor: "pointer", marginTop: 2 }}>
                        <input
                          type="checkbox"
                          checked={deleteDiskOnPurge}
                          onChange={(e) => setDeleteDiskOnPurge(e.target.checked)}
                          style={{ accentColor: "var(--color-danger)" }}
                        />
                        <span>Also delete local database file from Mac disk (<code>kanban.db</code>)</span>
                      </label>

                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: 4 }}>
                        <input
                          type="text"
                          value={purgeText}
                          onChange={(e) => setPurgeText(e.target.value)}
                          placeholder="Type 'PURGE ALL'"
                          className="modal-input"
                          style={{ flex: 1, height: 30, fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}
                        />
                        <button
                          onClick={handleFullFactoryReset}
                          disabled={isPurging || purgeText.trim() !== "PURGE ALL"}
                          className="btn-danger"
                          style={{ height: 30, padding: "0 12px", fontSize: "var(--text-xs)", gap: 6 }}
                        >
                          <Trash2 size={12} />
                          <span>{isPurging ? "Purging..." : "Purge Everything"}</span>
                        </button>
                      </div>

                      {purgeError && (
                        <div className="modal-error-alert">
                          <AlertTriangle size={13} />
                          <span>{purgeError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Workspace Defaults Tab */}
            {activeTab === "defaults" && (
              <div className="settings-section">
                <div className="settings-group">
                  <h3 className="settings-group-title">Link Opening Behavior</h3>
                  <p className="settings-group-desc">
                    Configure how external HTTP/HTTPS documentation links in tickets and notes open on your Mac.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                    <label
                      onClick={() => handleLinkTargetChange("tab")}
                      style={{
                        padding: "var(--space-3) var(--space-4)",
                        borderRadius: "var(--radius-lg)",
                        border: `1px solid ${linkTarget === "tab" ? "var(--accent-blue)" : "var(--border-default)"}`,
                        backgroundColor: linkTarget === "tab" ? "var(--accent-blue-subtle)" : "var(--bg-app)",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="linkTarget"
                        checked={linkTarget === "tab"}
                        onChange={() => handleLinkTargetChange("tab")}
                        style={{ accentColor: "var(--accent-blue)" }}
                      />
                      <div>
                        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>
                          Open in In-App Webview Tab (Recommended)
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                          Keeps documentation, PRs, and specs embedded in tabs alongside your Kanban board.
                        </div>
                      </div>
                    </label>

                    <label
                      onClick={() => handleLinkTargetChange("browser")}
                      style={{
                        padding: "var(--space-3) var(--space-4)",
                        borderRadius: "var(--radius-lg)",
                        border: `1px solid ${linkTarget === "browser" ? "var(--accent-blue)" : "var(--border-default)"}`,
                        backgroundColor: linkTarget === "browser" ? "var(--accent-blue-subtle)" : "var(--bg-app)",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="linkTarget"
                        checked={linkTarget === "browser"}
                        onChange={() => handleLinkTargetChange("browser")}
                        style={{ accentColor: "var(--accent-blue)" }}
                      />
                      <div>
                        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>
                          Open in Default macOS Browser (Safari / Chrome)
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                          Launches external browser windows outside the desktop application.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Default '+' Button Action */}
                <div className="settings-group" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
                  <h3 className="settings-group-title">Default '+' Button Action</h3>
                  <p className="settings-group-desc">
                    Configure what action is executed when you click the '+' button in the top navigation tab bar.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginTop: "var(--space-2)" }}>
                    {[
                      { id: "ticket", label: "New Ticket", desc: "Open draft ticket tab (Default)" },
                      { id: "todo", label: "Todos", desc: "Open daily todo manager" },
                      { id: "notepad", label: "Notepad & Canvas", desc: "Scratchpad and whiteboard" },
                      { id: "focus", label: "Focus Timer", desc: "Start customized timer" },
                      { id: "epic", label: "New Epic", desc: "Create milestone epic" },
                    ].map((item) => {
                      const isSelected = defaultPlusAction === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-testid={`default-plus-option-${item.id}`}
                          onClick={() => handlePlusActionChange(item.id)}
                          style={{
                            padding: "10px",
                            borderRadius: "var(--radius-lg)",
                            border: `2px solid ${isSelected ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                            backgroundColor: isSelected ? "var(--accent-blue-subtle)" : "var(--bg-app)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: 4,
                            cursor: "pointer",
                            transition: "all var(--transition-fast)",
                            textAlign: "left",
                          }}
                        >
                          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: isSelected ? "var(--accent-blue)" : "var(--text-primary)" }}>
                            {item.label}
                          </span>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                            {item.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 5. Notifications Tab */}
            {activeTab === "notifications" && (
              <div className="settings-section" data-testid="settings-notifications-panel">
                <div className="settings-group">
                  <h3 className="settings-group-title">Notification Sounds</h3>
                  <p className="settings-group-desc">
                    Customize audible alerts for scheduled todo reminders and alarms.
                  </p>

                  {/* Sound On / Off Toggle */}
                  <div
                    style={{
                      padding: "var(--space-3) var(--space-4)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-app)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "var(--space-2)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      {soundEnabled ? (
                        <Volume2 size={18} color="var(--accent-blue)" />
                      ) : (
                        <VolumeX size={18} color="var(--text-muted)" />
                      )}
                      <div>
                        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>
                          Play Sound on Reminder Alerts
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                          {soundEnabled ? "Audible alert will chime when reminders trigger." : "Reminders will be silent."}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid="toggle-sound-enabled"
                      className={soundEnabled ? "btn-primary" : "btn-secondary"}
                      onClick={() => {
                        const next = !soundEnabled;
                        setSoundEnabled(next);
                        setNotificationSoundEnabled(next);
                        if (next) {
                          playNotificationSound(selectedSound, true);
                        }
                      }}
                      style={{ height: "28px", padding: "0 12px", fontSize: "var(--text-xs)" }}
                    >
                      {soundEnabled ? "Enabled" : "Muted"}
                    </button>
                  </div>

                  {/* Continuous Ringing Toggle (macOS Alert Style) */}
                  <div
                    style={{
                      padding: "var(--space-3) var(--space-4)",
                      backgroundColor: "var(--bg-app)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "var(--space-3)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>
                          Continuous Ringing (macOS Alert Style)
                        </span>
                        {continuousRingEnabled && (
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "1px 6px",
                              borderRadius: "10px",
                              backgroundColor: "rgba(59, 130, 246, 0.15)",
                              color: "var(--accent-blue)",
                              fontWeight: 600,
                            }}
                          >
                            Persistent Ring
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        Keep ringing alert sound repeating until dismissed or silenced, matching native macOS persistent notifications.
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid="toggle-continuous-ring"
                      className={continuousRingEnabled ? "btn-primary" : "btn-secondary"}
                      onClick={() => {
                        const next = !continuousRingEnabled;
                        setContinuousRingEnabledState(next);
                        setContinuousRingEnabled(next);
                      }}
                      style={{ height: "28px", padding: "0 12px", fontSize: "var(--text-xs)" }}
                    >
                      {continuousRingEnabled ? "Continuous" : "Single Tone"}
                    </button>
                  </div>

                  {/* Default Sounds Selector */}
                  <div style={{ marginTop: "var(--space-4)" }}>
                    <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
                      Default Alert Sound
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "var(--space-2)" }}>
                      {NOTIFICATION_SOUNDS.map((snd) => {
                        const isSelected = selectedSound === snd.id;
                        return (
                          <div
                            key={snd.id}
                            data-testid={`sound-option-${snd.id}`}
                            onClick={() => {
                              setSelectedSound(snd.id);
                              setSelectedNotificationSound(snd.id);
                              playNotificationSound(snd.id, true);
                            }}
                            style={{
                              padding: "var(--space-2) var(--space-3)",
                              borderRadius: "var(--radius-md)",
                              border: `1px solid ${isSelected ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                              backgroundColor: isSelected ? "var(--accent-blue-subtle)" : "var(--bg-app)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              cursor: "pointer",
                              transition: "all var(--transition-fast)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                              <input
                                type="radio"
                                name="notificationSound"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedSound(snd.id);
                                  setSelectedNotificationSound(snd.id);
                                  playNotificationSound(snd.id, true);
                                }}
                                style={{ accentColor: "var(--accent-blue)" }}
                              />
                              <div>
                                <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>
                                  {snd.name}
                                </div>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                  {snd.description}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              data-testid={`preview-sound-${snd.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                playNotificationSound(snd.id, true);
                              }}
                              className="btn-ghost btn-sm"
                              style={{
                                height: "24px",
                                padding: "0 8px",
                                fontSize: "11px",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              title={`Preview ${snd.name} sound`}
                            >
                              <Play size={11} fill="currentColor" />
                              <span>Preview</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* macOS Desktop Notifications Group */}
                <div className="settings-group" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
                  <h3 className="settings-group-title">macOS Desktop Notifications</h3>
                  <p className="settings-group-desc">
                    Allows the application to send native notifications to macOS Notification Center even when minimized.
                  </p>

                  <div
                    style={{
                      padding: "var(--space-3) var(--space-4)",
                      backgroundColor: "var(--bg-app)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "var(--space-2)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>System Permission:</span>
                        <span
                          data-testid="notification-permission-badge"
                          style={{
                            fontSize: "11px",
                            padding: "1px 6px",
                            borderRadius: "10px",
                            fontWeight: 600,
                            textTransform: "capitalize",
                            backgroundColor:
                              notifPermission === "granted"
                                ? "rgba(16, 185, 129, 0.15)"
                                : notifPermission === "denied"
                                ? "rgba(239, 68, 68, 0.15)"
                                : "rgba(59, 130, 246, 0.15)",
                            color:
                              notifPermission === "granted"
                                ? "var(--color-success)"
                                : notifPermission === "denied"
                                ? "var(--color-danger)"
                                : "var(--accent-blue)",
                          }}
                        >
                          {notifPermission}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {isTauriEnvironment()
                          ? "macOS Notification Center integration active. Alerts and sounds post natively on macOS."
                          : notifPermission === "granted"
                          ? "Desktop notifications are active and ready."
                          : "Click below to prompt macOS to permit notifications."}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {notifPermission !== "granted" && (
                        <button
                          type="button"
                          data-testid="request-notification-perm-btn"
                          className="btn-primary btn-sm"
                          onClick={async () => {
                            const res = await requestNotificationPermission();
                            setNotifPermission(res);
                          }}
                          style={{ height: "28px", padding: "0 10px", fontSize: "var(--text-xs)" }}
                        >
                          Request Permission
                        </button>
                      )}

                      {isRinging && (
                        <button
                          type="button"
                          data-testid="stop-test-ringing-btn"
                          className="btn-danger btn-sm"
                          onClick={() => {
                            stopContinuousRing();
                            setIsRinging(false);
                          }}
                          style={{ height: "28px", padding: "0 10px", fontSize: "var(--text-xs)", display: "flex", alignItems: "center", gap: "4px" }}
                          title="Stop repeating ring sound"
                        >
                          <VolumeX size={12} />
                          <span>Stop Ringing</span>
                        </button>
                      )}

                      <button
                        type="button"
                        data-testid="send-test-notification-btn"
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          sendDesktopNotification({
                            title: "Tolaria Reminder Alert",
                            body: `Testing ${selectedSound} sound with persistent macOS alert.`,
                            sound: selectedSound,
                            playSound: soundEnabled,
                            persistent: true,
                            continuousRing: continuousRingEnabled,
                          });
                          setTestSentMessage(true);
                          setTimeout(() => setTestSentMessage(false), 2500);
                        }}
                        style={{ height: "28px", padding: "0 10px", fontSize: "var(--text-xs)" }}
                      >
                        {testSentMessage ? "Sent!" : "Send Test Alert"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. MCP Agent Tab */}
            {activeTab === "mcp" && (
              <div className="settings-section" data-testid="settings-panel-mcp">
                <McpSettingsPanel />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
