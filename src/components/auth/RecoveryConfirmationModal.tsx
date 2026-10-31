import React, { useState } from "react";
import { KeyRound, Copy, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface RecoveryConfirmationModalProps {
  userId: string;
  recoveryKey: string;
  onConfirmSuccess: () => void;
  onCancel: () => void;
}

export const RecoveryConfirmationModal: React.FC<RecoveryConfirmationModalProps> = ({
  recoveryKey,
  onConfirmSuccess,
  onCancel,
}) => {
  useEscapeKey(true, onCancel);

  const [copied, setCopied] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    try {
      // Normalize comparison
      const cleanInput = inputKey.toUpperCase().replace(/[^2-9A-Z]/g, "");
      const cleanTarget = recoveryKey.toUpperCase().replace(/[^2-9A-Z]/g, "");

      if (cleanInput !== cleanTarget) {
        setError("The entered recovery key does not match. Please verify carefully.");
        setIsVerifying(false);
        return;
      }

      onConfirmSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 500 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: "rgba(245, 158, 11, 0.15)",
            color: "var(--color-warning)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <KeyRound size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>Save Your Recovery Key</h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              Offline password recovery requires this key
            </p>
          </div>
        </div>

        <div style={{
          backgroundColor: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.25)",
          borderRadius: "var(--radius-md)",
          padding: 12,
          display: "flex",
          gap: 10,
          marginBottom: 20
        }}>
          <AlertTriangle size={18} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.4 }}>
            This application is 100% offline. If you lose your password and recovery key, your data cannot be recovered. Store this key in a secure location.
          </p>
        </div>

        {/* Display Recovery Key */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <div className="recovery-key-display">
            {recoveryKey}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="btn-secondary"
            style={{
              position: "absolute",
              right: 8,
              top: 8,
              height: 28,
              padding: "0 10px",
              fontSize: "var(--text-sm)"
            }}
          >
            {copied ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Confirmation Form */}
        <form onSubmit={handleVerify}>
          <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: 8 }}>
            Confirm your recovery key to activate account:
          </label>
          <input
            type="text"
            className="input-text"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"
            style={{ marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}
            autoFocus
          />

          {error && (
            <div style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)", marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!inputKey.trim() || isVerifying}
              className="btn-primary"
            >
              <ShieldCheck size={16} />
              <span>{isVerifying ? "Verifying..." : "Confirm & Activate"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
