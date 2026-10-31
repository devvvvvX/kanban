import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { RecoveryConfirmationModal } from "./RecoveryConfirmationModal";
import { Lock, Mail, User, Clock, ShieldAlert, Key } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  defaultTab?: "login" | "register";
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultTab = "login",
}) => {
  useEscapeKey(Boolean(isOpen && onClose), () => onClose?.());
  const {
    login,
    register,
    resumePendingRegistration,
    confirmRecoveryKey,
    resetPasswordWithRecoveryKey,
    initError,
    retryInit,
    isLoading: isDbLoading,
    accounts,
  } = useAuth();

  const [mode, setMode] = useState<"login" | "register" | "recovery">(defaultTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isPendingActivation, setIsPendingActivation] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);

  // Recovery confirmation gate state
  const [pendingRecovery, setPendingRecovery] = useState<{
    userId: string;
    key: string;
  } | null>(null);

  // Countdown timer for rate limiting lockout
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  // Reset form ONLY when modal transitions from closed to open
  const prevIsOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setMode(defaultTab);
      setPassword("");
      setConfirmPassword("");
      setRecoveryKeyInput("");
      setError(null);
      setIsPendingActivation(false);
      setSuccessMsg(null);
      setPendingRecovery(null);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  const handleResumePendingActivation = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await resumePendingRegistration(email, password);
      if (!res.success || !res.recoveryKey || !res.user) {
        setError(res.error || "Failed to resume activation. Please check your password.");
      } else {
        setIsPendingActivation(false);
        setPendingRecovery({
          userId: res.user.id,
          key: res.recoveryKey,
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPendingActivation(false);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      if (mode === "login") {
        const res = await login(email, password, durationDays, keepSignedIn);
        if (!res.success) {
          if (res.error?.includes("pending recovery key confirmation")) {
            setIsPendingActivation(true);
            setError(
              "Account registration is pending recovery key confirmation. Click below to view your recovery key and activate your account."
            );
          } else {
            setIsPendingActivation(false);
            setError(res.error || "Login failed");
          }
          if (res.remainingSeconds) {
            setCountdown(res.remainingSeconds);
          }
        } else {
          onClose?.();
        }
      } else if (mode === "register") {
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setSubmitting(false);
          return;
        }

        const res = await register(email, password, displayName);
        if (!res.success || !res.recoveryKey || !res.user) {
          setError(res.error || "Registration failed");
        } else {
          // Open recovery key confirmation gate
          setPendingRecovery({
            userId: res.user.id,
            key: res.recoveryKey,
          });
        }
      } else if (mode === "recovery") {
        if (password !== confirmPassword) {
          setError("New passwords do not match");
          setSubmitting(false);
          return;
        }

        const res = await resetPasswordWithRecoveryKey(email, recoveryKeyInput, password);
        if (!res.success) {
          setError(res.error || "Password reset failed");
        } else {
          setSuccessMsg("Password successfully reset! You can now log in.");
          setMode("login");
          setPassword("");
          setConfirmPassword("");
          setRecoveryKeyInput("");
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingRecovery) {
    return (
      <RecoveryConfirmationModal
        userId={pendingRecovery.userId}
        recoveryKey={pendingRecovery.key}
        onConfirmSuccess={async () => {
          const res = await confirmRecoveryKey(pendingRecovery.userId, pendingRecovery.key);
          if (res.success) {
            setPendingRecovery(null);
            onClose?.();
          } else {
            setError(res.error || "Verification failed");
          }
        }}
        onCancel={() => {
          setPendingRecovery(null);
          setMode("login");
        }}
      />
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        {/* App Branding */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 20 }}>
          <img
            src="/icon.png"
            alt="Kanban Icon"
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              objectFit: "contain",
              filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.35))",
            }}
          />
          <div>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.2 }}>
              Kanban
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              Offline-First Personal Management
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        {mode !== "recovery" ? (
          <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", marginBottom: 20 }}>
            <button
              type="button"
              data-testid="auth-tab-login"
              onClick={() => { setMode("login"); setError(null); }}
              style={{
                flex: 1,
                padding: "10px 0",
                background: "transparent",
                border: "none",
                borderBottom: mode === "login" ? "2px solid var(--accent-blue)" : "2px solid transparent",
                color: mode === "login" ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: mode === "login" ? 600 : 400,
                cursor: "pointer",
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              data-testid="auth-tab-register"
              onClick={() => { setMode("register"); setError(null); }}
              style={{
                flex: 1,
                padding: "10px 0",
                background: "transparent",
                border: "none",
                borderBottom: mode === "register" ? "2px solid var(--accent-blue)" : "2px solid transparent",
                color: mode === "register" ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: mode === "register" ? 600 : 400,
                cursor: "pointer",
              }}
            >
              Create Account
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>Reset Password Offline</h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              Enter your recovery key and choose a new password
            </p>
          </div>
        )}

        {initError && (
          <div style={{
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            border: "1px solid var(--color-danger)",
            borderRadius: "var(--radius-md)",
            padding: "10px 12px",
            fontSize: "var(--text-sm)",
            color: "var(--color-danger)",
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldAlert size={16} />
              <span>Workspace initialization error: {initError}</span>
            </div>
            <button
              type="button"
              onClick={() => retryInit()}
              style={{
                alignSelf: "flex-start",
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 600,
                background: "var(--color-danger)",
                color: "#ffffff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
              }}
            >
              Retry Initialization
            </button>
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: "var(--color-danger-subtle)",
            border: "1px solid var(--color-danger)",
            borderRadius: "var(--radius-md)",
            padding: 10,
            fontSize: "var(--text-sm)",
            color: "var(--color-danger)",
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <ShieldAlert size={16} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
            {isPendingActivation ? (
              <button
                type="button"
                onClick={handleResumePendingActivation}
                disabled={submitting}
                className="btn-primary"
                style={{
                  alignSelf: "flex-start",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  marginTop: 4,
                }}
              >
                View Recovery Key & Complete Activation
              </button>
            ) : null}
          </div>
        )}

        {successMsg && (
          <div style={{
            backgroundColor: "rgba(16, 185, 129, 0.12)",
            border: "1px solid var(--color-success)",
            borderRadius: "var(--radius-md)",
            padding: 10,
            fontSize: "var(--text-sm)",
            color: "var(--color-success)",
            marginBottom: 16,
          }}>
            {successMsg}
          </div>
        )}

        {countdown > 0 && (
          <div style={{
            backgroundColor: "rgba(245, 158, 11, 0.1)",
            border: "1px solid var(--color-warning)",
            borderRadius: "var(--radius-md)",
            padding: 10,
            fontSize: "var(--text-sm)",
            color: "var(--color-warning)",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <Clock size={16} />
            <span>Lockout active: retry available in {countdown} seconds</span>
          </div>
        )}

        {/* Local accounts quick-select if available */}
        {accounts.length > 0 && mode === "login" && (
          <div style={{
            backgroundColor: "var(--bg-muted)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "8px 10px",
            marginBottom: 14,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
              Local Accounts on this Mac:
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 110, overflowY: "auto", padding: "2px 0" }}>
              {accounts.map((acc) => {
                const isSelected = email.toLowerCase() === acc.email.toLowerCase();
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setError(null);
                    }}
                    style={{
                      padding: "3px 8px",
                      borderRadius: "var(--radius-full, 9999px)",
                      border: isSelected ? "1px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                      background: isSelected ? "rgba(59, 130, 246, 0.15)" : "var(--bg-card)",
                      color: isSelected ? "var(--accent-blue)" : "var(--text-primary)",
                      fontSize: "var(--text-xs)",
                      fontWeight: isSelected ? 600 : 400,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>{acc.display_name || acc.email.split("@")[0]}</span>
                    <span style={{ opacity: 0.65 }}>({acc.email})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "register" && (
            <div>
              <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: 6 }}>
                Display Name (Optional)
              </label>
              <div style={{ position: "relative" }}>
                <User size={16} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
                <input
                  type="text"
                  className="input-text"
                  placeholder="Your Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{ paddingLeft: 34 }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: 6 }}>
              Local Account Email
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={16} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
              <input
                type="email"
                required
                className="input-text"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: 34 }}
              />
            </div>
          </div>

          {mode === "recovery" && (
            <div>
              <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: 6 }}>
                Recovery Key
              </label>
              <div style={{ position: "relative" }}>
                <Key size={16} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
                <input
                  type="text"
                  required
                  className="input-text"
                  placeholder="REC-XXXX-XXXX-XXXX-XXXX"
                  value={recoveryKeyInput}
                  onChange={(e) => setRecoveryKeyInput(e.target.value)}
                  style={{ paddingLeft: 34, fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: 6 }}>
              {mode === "recovery" ? "New Password (min 8 chars)" : "Password"}
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={16} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
              <input
                type="password"
                required
                minLength={8}
                className="input-text"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: 34 }}
              />
            </div>
          </div>

          {(mode === "register" || mode === "recovery") && (
            <div>
              <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: 6 }}>
                Confirm Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
                <input
                  type="password"
                  required
                  minLength={8}
                  className="input-text"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ paddingLeft: 34 }}
                />
              </div>
            </div>
          )}

          {mode === "login" && (
            <>
              {/* Session Duration Selector (AUTH-05) */}
              <div style={{
                backgroundColor: "var(--bg-muted)",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500 }}>
                    Session Duration
                  </span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--accent-blue)", fontWeight: 600 }}>
                    {durationDays} days
                  </span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={180}
                  step={15}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--accent-blue)" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  <span>30 days</span>
                  <span>90 days</span>
                  <span>180 days</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--text-sm)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "var(--text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    style={{ accentColor: "var(--accent-blue)" }}
                  />
                  <span>Keep me signed in</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setMode("recovery"); setError(null); }}
                  style={{ background: "transparent", border: "none", color: "var(--accent-blue)", cursor: "pointer", fontSize: "var(--text-sm)" }}
                >
                  Forgot password?
                </button>
              </div>
            </>
          )}

          {mode === "recovery" && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); }}
                style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "var(--text-sm)" }}
              >
                Back to Sign In
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || countdown > 0 || isDbLoading || !!initError}
            className="btn-primary"
            style={{ width: "100%", height: 38, marginTop: 4 }}
          >
            {isDbLoading
              ? "Initializing Database..."
              : initError
              ? "Initialization Error"
              : submitting
              ? "Processing..."
              : mode === "login"
              ? "Sign In"
              : mode === "register"
              ? "Create Account & Get Key"
              : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
};
