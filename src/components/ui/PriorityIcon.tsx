import React from "react";
import type { TicketPriority } from "../../lib/tickets/ticketService";

interface PriorityIconProps {
  priority: TicketPriority;
  size?: number;
  className?: string;
  showLabel?: boolean;
}

export const PRIORITY_META: Record<
  TicketPriority,
  { label: string; color: string; order: number }
> = {
  urgent: { label: "Urgent", color: "#EF4444", order: 4 },
  high: { label: "High", color: "#F59E0B", order: 3 },
  medium: { label: "Medium", color: "#3B82F6", order: 2 },
  low: { label: "Low", color: "#64748B", order: 1 },
  none: { label: "None", color: "#9CA3AF", order: 0 },
};

export const PriorityIcon: React.FC<PriorityIconProps> = ({
  priority,
  size = 14,
  className = "",
  showLabel = false,
}) => {
  const meta = PRIORITY_META[priority] || PRIORITY_META.none;

  const renderIcon = () => {
    switch (priority) {
      case "urgent":
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            className={className}
            style={{ flexShrink: 0 }}
          >
            <rect
              x="2"
              y="2"
              width="12"
              height="12"
              rx="3"
              fill="rgba(239, 68, 68, 0.15)"
              stroke={meta.color}
              strokeWidth="1.2"
            />
            <path
              d="M8 5V9M8 11.5V12"
              stroke={meta.color}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        );

      case "high":
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            className={className}
            style={{ flexShrink: 0 }}
          >
            <rect x="2.5" y="10" width="2.5" height="4" rx="0.75" fill={meta.color} />
            <rect x="6.75" y="6.5" width="2.5" height="7.5" rx="0.75" fill={meta.color} />
            <rect x="11" y="3" width="2.5" height="11" rx="0.75" fill={meta.color} />
          </svg>
        );

      case "medium":
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            className={className}
            style={{ flexShrink: 0 }}
          >
            <rect x="3" y="10" width="2.5" height="4" rx="0.75" fill={meta.color} />
            <rect x="7.5" y="6.5" width="2.5" height="7.5" rx="0.75" fill={meta.color} />
            <rect x="12" y="3" width="2.5" height="11" rx="0.75" fill="var(--border-subtle)" />
          </svg>
        );

      case "low":
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            className={className}
            style={{ flexShrink: 0 }}
          >
            <rect x="3" y="10" width="2.5" height="4" rx="0.75" fill={meta.color} />
            <rect x="7.5" y="6.5" width="2.5" height="7.5" rx="0.75" fill="var(--border-subtle)" />
            <rect x="12" y="3" width="2.5" height="11" rx="0.75" fill="var(--border-subtle)" />
          </svg>
        );

      case "none":
      default:
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            className={className}
            style={{ flexShrink: 0 }}
          >
            <circle cx="4" cy="8" r="1.25" fill={meta.color} />
            <circle cx="8" cy="8" r="1.25" fill={meta.color} />
            <circle cx="12" cy="8" r="1.25" fill={meta.color} />
          </svg>
        );
    }
  };

  if (!showLabel) {
    return renderIcon();
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "var(--text-xs)",
        fontWeight: 500,
        color: "var(--text-secondary)",
      }}
      title={`Priority: ${meta.label}`}
    >
      {renderIcon()}
      <span>{meta.label}</span>
    </span>
  );
};

