import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { ChevronDown, Check, UserPlus, LogOut, Shield } from "lucide-react";

interface AccountSwitcherProps {
  onOpenAuth: () => void;
}

export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({ onOpenAuth }) => {
  const { user, accounts, switchAccount, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  if (!user) {
    return (
      <button onClick={onOpenAuth} className="btn-primary no-drag" style={{ height: 32, fontSize: "var(--text-sm)" }}>
        Sign In
      </button>
    );
  }

  return (
    <div style={{ position: "relative" }} ref={dropdownRef} className="no-drag">
      <button
        type="button"
        data-testid="account-switcher-btn"
        onClick={() => setOpen(!open)}
        className="btn-secondary"
        style={{
          height: 28,
          padding: "0 10px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderRadius: "var(--radius-full)",
          fontSize: "var(--text-xs)",
          fontWeight: 500,
        }}
        title={`Account: ${user.display_name || user.email}`}
      >
        <span style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {user.display_name || user.email}
        </span>
        <ChevronDown size={13} color="var(--text-muted)" />
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "100%",
          right: 0,
          marginTop: 6,
          width: 240,
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          padding: 6,
          zIndex: 500,
          animation: "fadeIn var(--transition-fast)",
        }}>
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4 }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
              Local Accounts on this Mac
            </div>
          </div>

          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {accounts.map((acc) => {
              const isActive = acc.id === user.id;
              return (
                <button
                  key={acc.id}
                  onClick={() => {
                    if (!isActive) switchAccount(acc.id);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: isActive ? "var(--accent-blue-subtle)" : "transparent",
                    color: isActive ? "var(--accent-blue)" : "var(--text-primary)",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: "var(--text-xs)",
                    transition: "background-color var(--transition-fast)",
                  }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {acc.display_name}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {acc.email}
                    </div>
                  </div>
                  {isActive && <Check size={14} />}
                </button>
              );
            })}
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 6, paddingTop: 4 }}>
            <button
              onClick={() => {
                setOpen(false);
                onOpenAuth();
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: "var(--radius-md)",
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                fontSize: "var(--text-xs)",
                cursor: "pointer",
              }}
            >
              <UserPlus size={14} />
              <span>Add / Switch Account</span>
            </button>

            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: "var(--radius-md)",
                background: "transparent",
                border: "none",
                color: "var(--color-danger)",
                fontSize: "var(--text-xs)",
                cursor: "pointer",
              }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 4, paddingTop: 4, paddingLeft: 8, paddingRight: 8, display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-muted)" }}>
            <Shield size={10} />
            <span>Isolated local database</span>
          </div>
        </div>
      )}
    </div>
  );
};
