import React, { useState, useEffect } from "react";
import {
  Bot,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { SessionService } from "../../lib/auth/sessionService";
import { McpConfigService } from "../../lib/mcp/mcpConfigService";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface McpSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const McpSettingsModal: React.FC<McpSettingsModalProps> = ({ isOpen, onClose }) => {
  useEscapeKey(isOpen, onClose);

  const { user } = useAuth();
  const [token, setToken] = useState<string>("");
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [binaryMode, setBinaryMode] = useState<"app" | "dev">("app");

  useEffect(() => {
    if (!isOpen || !user) return;
    const configService = new McpConfigService();
    setIsEnabled(configService.isMcpEnabled(user.id));
  }, [isOpen, user]);

  const handleToggleMcp = (newVal: boolean) => {
    if (!user) return;
    setIsEnabled(newVal);
    const configService = new McpConfigService();
    configService.setMcpEnabled(user.id, newVal);
  };

  useEffect(() => {
    if (!isOpen || !user) return;

    try {
      const sessionService = new SessionService();
      const storedToken = localStorage.getItem(`kanban_session_token_${user.id}`);
      if (storedToken) {
        const validation = sessionService.validateSession(storedToken);
        if (validation.valid) {
          setToken(storedToken);
          return;
        }
      }

      const session = sessionService.createSession(user.id, 180, true);
      localStorage.setItem(`kanban_session_token_${user.id}`, session.token);
      setToken(session.token);
    } catch (err) {
      console.error("[McpSettings] Failed to initialize token:", err);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleCopyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleRegenerateToken = () => {
    if (!user) return;
    setIsRegenerating(true);
    try {
      const sessionService = new SessionService();
      const newSession = sessionService.createSession(user.id, 180, true);
      localStorage.setItem(`kanban_session_token_${user.id}`, newSession.token);
      setToken(newSession.token);
      setCopiedToken(false);
    } catch (err) {
      console.error("[McpSettings] Failed to regenerate token:", err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const serverConfig = binaryMode === "app"
    ? {
        command: "/Applications/Kanban.app/Contents/MacOS/kanban-mcp",
        args: [],
        env: {
          KANBAN_AUTH_TOKEN: token || "<token>",
        },
      }
    : {
        command: "node",
        args: [
          "/path/to/kanban/dist/mcp/cli.js",
        ],
        env: {
          KANBAN_AUTH_TOKEN: token || "<token>",
        },
      };

  const claudeDesktopConfig = JSON.stringify(
    {
      mcpServers: {
        "macos-kanban": serverConfig,
      },
    },
    null,
    2
  );

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(claudeDesktopConfig);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mcp-modal-card">
        {/* Header */}
        <div className="mcp-modal-header">
          <div className="mcp-modal-header-info">
            <div className="mcp-modal-icon-badge">
              <Bot size={16} />
            </div>
            <div>
              <h2 className="mcp-modal-title">
                Model Context Protocol (MCP) Agent
              </h2>
              <p className="mcp-modal-subtitle">
                Native stdio agent integration conforming to official MCP 2024-11-05 spec
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-ghost btn-icon btn-sm"
            aria-label="Close"
            title="Close (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div className="mcp-modal-body">
          {/* Master Enable Row */}
          <div className="mcp-setting-row">
            <div className="mcp-setting-text">
              <div className="mcp-setting-label">
                Enable MCP Agent Access
              </div>
              <div className="mcp-setting-desc">
                {isEnabled
                  ? "Authorize local AI agents (Claude Desktop, Cursor, Antigravity) to execute tools via stdio."
                  : "MCP tool execution is turned OFF. All tool calls from external agents will be rejected."}
              </div>
            </div>

            <label className="toggle-switch" aria-label="Toggle MCP Agent Access">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => handleToggleMcp(e.target.checked)}
                data-testid="mcp-master-toggle"
                className="toggle-switch-input"
              />
              <span className="toggle-switch-slider" />
            </label>
          </div>

          {/* Status Banner */}
          <div
            data-testid="mcp-status-banner"
            className={`mcp-status-banner ${isEnabled ? "active" : "disabled"}`}
          >
            <div className="mcp-status-banner-left">
              <span className={`mcp-status-pip ${isEnabled ? "active" : "disabled"}`} />
              <div>
                <span className="mcp-status-heading">
                  {isEnabled ? "MCP Stdio Server Ready" : "MCP Agent Access Disabled"}
                </span>
                <span className="mcp-status-subtext">
                  {isEnabled
                    ? "Connect Claude Desktop, Cursor, or Antigravity to manage tickets directly."
                    : "External tool executions are blocked until MCP is re-enabled."}
                </span>
              </div>
            </div>

            <span className="mcp-status-count-tag">
              {isEnabled ? "8 Tools Active" : "Inactive"}
            </span>
          </div>

          {/* Transport & Zero Network Ports Card */}
          <div data-testid="mcp-transport-info" className="mcp-card">
            <div className="mcp-card-header">
              <span className="mcp-card-title">
                Transport Architecture &amp; Ports
              </span>
              <span className="mcp-tag-pill">
                Local Stdio (Zero Network Ports)
              </span>
            </div>
            <p className="mcp-card-desc">
              Kanban MCP operates strictly over <strong>local standard I/O (stdio)</strong> conforming to the official Model Context Protocol specification. When configured in Claude Desktop or Cursor, the client launches the local script directly as a subprocess. <strong>No background network ports or TCP sockets are opened</strong>, guaranteeing 100% offline isolation with zero port collisions and zero network exposure.
            </p>
          </div>

          {/* Token Section */}
          <div className="mcp-section">
            <div className="mcp-section-header">
              <label className="mcp-section-label">
                Agent Authorization Token
              </label>
              <button
                type="button"
                onClick={handleRegenerateToken}
                disabled={isRegenerating}
                className="btn-ghost btn-sm"
                style={{ height: 24, padding: "0 8px", gap: 4 }}
                title="Regenerate Token"
              >
                <RefreshCw size={11} className={isRegenerating ? "spin-animation" : ""} />
                <span>Regenerate</span>
              </button>
            </div>

            <p className="mcp-section-desc">
              AI agents must pass this token via the <code>KANBAN_AUTH_TOKEN</code> environment variable to ensure complete account isolation.
            </p>

            <div className="mcp-input-group">
              <span className="mcp-token-display">
                {token ? (isTokenVisible ? token : "••••••••••••••••••••••••••••••••") : "Generating token..."}
              </span>

              <button
                type="button"
                onClick={() => setIsTokenVisible(!isTokenVisible)}
                className="btn-ghost btn-icon btn-sm"
                style={{ width: 26, height: 26 }}
                title={isTokenVisible ? "Hide Token" : "Show Token"}
              >
                {isTokenVisible ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>

              <button
                type="button"
                onClick={handleCopyToken}
                className="btn-secondary btn-sm"
                style={{ height: 26, padding: "0 10px", gap: 4 }}
              >
                {copiedToken ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                <span>{copiedToken ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Client Configuration Section */}
          <div className="mcp-section">
            <div className="mcp-section-header">
              <label className="mcp-section-label">
                Claude Desktop Configuration (<code>claude_desktop_config.json</code>)
              </label>
              <button
                type="button"
                onClick={handleCopyConfig}
                className="btn-secondary btn-sm"
                style={{ height: 24, padding: "0 10px", gap: 4 }}
              >
                {copiedConfig ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                <span>{copiedConfig ? "Copied" : "Copy JSON"}</span>
              </button>
            </div>

            {/* Segmented Mode Selector */}
            <div className="segmented-control" style={{ marginBottom: "var(--space-2)", maxWidth: "fit-content" }}>
              <button
                type="button"
                className={`segmented-button ${binaryMode === "app" ? "active" : ""}`}
                onClick={() => setBinaryMode("app")}
              >
                Release App (/Applications/Kanban.app)
              </button>
              <button
                type="button"
                className={`segmented-button ${binaryMode === "dev" ? "active" : ""}`}
                onClick={() => setBinaryMode("dev")}
              >
                Development / CLI Source
              </button>
            </div>

            {!isEnabled && (
              <div
                data-testid="mcp-disabled-config-warning"
                className="mcp-warning-banner"
              >
                <AlertTriangle size={13} />
                <span>
                  <strong>MCP Access Disabled:</strong> External agents will receive an unauthorized error until MCP is enabled above.
                </span>
              </div>
            )}

            <pre className="mcp-code-block">
              <code>{claudeDesktopConfig}</code>
            </pre>
          </div>

          {/* Sync Guarantee */}
          <div className="mcp-sync-guarantee">
            <CheckCircle2 size={13} color="#10B981" />
            <span>
              <strong>Real-Time Sync Active (MCP-05):</strong> Board and ticket lists refresh automatically when tools mutate data.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mcp-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary btn-sm"
            style={{ minWidth: 70 }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
