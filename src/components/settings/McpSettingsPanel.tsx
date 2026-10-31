import React, { useState, useEffect } from "react";
import {
  Bot,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { SessionService } from "../../lib/auth/sessionService";
import { McpConfigService } from "../../lib/mcp/mcpConfigService";

export const McpSettingsPanel: React.FC = () => {
  const { user } = useAuth();
  const [token, setToken] = useState<string>("");
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [clientTab, setClientTab] = useState<"claude" | "cursor">("claude");

  useEffect(() => {
    if (!user) return;
    const configService = new McpConfigService();
    setIsEnabled(configService.isMcpEnabled(user.id));
  }, [user]);

  const handleToggleMcp = (newVal: boolean) => {
    if (!user) return;
    setIsEnabled(newVal);
    const configService = new McpConfigService();
    configService.setMcpEnabled(user.id, newVal);
  };

  useEffect(() => {
    if (!user) return;
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
  }, [user]);

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

  const serverConfig = {
    command: "/Applications/Kanban.app/Contents/MacOS/kanban-mcp",
    args: [],
    env: {
      KANBAN_AUTH_TOKEN: token || "<your-auth-token>",
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

  const cursorConfig = JSON.stringify(
    {
      "macos-kanban": {
        command: "/Applications/Kanban.app/Contents/MacOS/kanban-mcp",
        args: [],
        env: {
          KANBAN_AUTH_TOKEN: token || "<your-auth-token>",
        },
      },
    },
    null,
    2
  );

  const activeSnippet = clientTab === "claude" ? claudeDesktopConfig : cursorConfig;

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(activeSnippet);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  return (
    <div data-testid="mcp-settings-panel" style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Group Header */}
      <div>
        <h3 className="settings-group-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bot size={18} color="#10B981" />
          <span>Model Context Protocol (MCP)</span>
        </h3>
        <p className="settings-group-desc">
          Allow local AI coding agents (Claude Desktop, Cursor, Antigravity) to query and update your tickets via native stdio transport.
        </p>
      </div>

      {/* Master Toggle Card */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px",
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--bg-app)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
              MCP Server Status
            </span>
            <span
              data-testid="mcp-status-pill"
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                backgroundColor: isEnabled ? "rgba(16, 185, 129, 0.15)" : "var(--bg-muted)",
                color: isEnabled ? "#10B981" : "var(--text-muted)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: isEnabled ? "#10B981" : "var(--text-muted)",
                }}
              />
              {isEnabled ? "Active & Ready" : "Disabled"}
            </span>
          </div>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            {isEnabled
              ? "Accepting secure stdio connections from authenticated local agents."
              : "All MCP tool requests from external agents will be rejected."}
          </span>
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

      {/* Session Auth Token Card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "16px",
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--bg-app)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
              Authentication Token
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              Scoped to local user ({user?.email}) for secure offline authentication
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              onClick={() => setIsTokenVisible(!isTokenVisible)}
              className="btn-ghost btn-sm"
              style={{ fontSize: "11px", height: 26, padding: "0 8px", gap: 4 }}
              title={isTokenVisible ? "Hide token" : "Reveal token"}
            >
              {isTokenVisible ? <EyeOff size={12} /> : <Eye size={12} />}
              <span>{isTokenVisible ? "Hide" : "Show"}</span>
            </button>

            <button
              type="button"
              onClick={handleRegenerateToken}
              disabled={isRegenerating}
              className="btn-ghost btn-sm"
              style={{ fontSize: "11px", height: 26, padding: "0 8px", gap: 4 }}
              title="Rotate authentication token"
            >
              <RefreshCw size={12} className={isRegenerating ? "spin-animation" : ""} />
              <span>Regenerate</span>
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            backgroundColor: "var(--bg-surface)",
            padding: "8px 12px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div
            data-testid="mcp-token-display"
            style={{
              flex: 1,
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--text-primary)",
              letterSpacing: isTokenVisible ? "0.04em" : "0.2em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {isTokenVisible
              ? token || "No token available"
              : token
              ? "••••••••••••••••••••••••••••••••••••••••"
              : "••••••••"}
          </div>

          <button
            type="button"
            data-testid="mcp-copy-token-btn"
            onClick={handleCopyToken}
            className="btn-secondary btn-sm"
            style={{ height: 26, padding: "0 10px", fontSize: "11px", gap: 4 }}
          >
            {copiedToken ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copiedToken ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* AI Client Configuration Snippet Card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "16px",
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--bg-app)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
              Agent Configuration
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              Add to your agent settings to auto-register macOS Kanban tools
            </div>
          </div>

          <button
            type="button"
            data-testid="mcp-copy-config-btn"
            onClick={handleCopyConfig}
            className="btn-primary btn-sm"
            style={{ height: 28, padding: "0 12px", fontSize: "11px", gap: 5 }}
          >
            {copiedConfig ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedConfig ? "Config Copied!" : "Copy JSON"}</span>
          </button>
        </div>

        {/* Tab switcher */}
        <div className="segmented-control" style={{ width: "fit-content" }}>
          <button
            type="button"
            className={`segmented-button ${clientTab === "claude" ? "active" : ""}`}
            onClick={() => setClientTab("claude")}
          >
            Claude Desktop
          </button>
          <button
            type="button"
            className={`segmented-button ${clientTab === "cursor" ? "active" : ""}`}
            onClick={() => setClientTab("cursor")}
          >
            Cursor / Antigravity
          </button>
        </div>

        {/* Code Snippet Box */}
        <pre
          style={{
            margin: 0,
            padding: "12px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            overflowX: "auto",
          }}
        >
          {activeSnippet}
        </pre>
      </div>
    </div>
  );
};
