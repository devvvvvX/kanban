import React from "react";
import type { WorkflowStateCategory } from "../../lib/tickets/workflowStateService";

interface StatusIconProps {
  category: WorkflowStateCategory;
  color?: string;
  size?: number;
  className?: string;
}

export const StatusIcon: React.FC<StatusIconProps> = ({
  category,
  color,
  size = 14,
  className = "",
}) => {
  const iconColor = color || (
    category === "completed"
      ? "var(--color-success)"
      : category === "started"
      ? "var(--color-warning)"
      : category === "cancelled"
      ? "var(--text-muted)"
      : category === "backlog"
      ? "var(--text-muted)"
      : "var(--accent-blue)"
  );

  switch (category) {
    case "backlog":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          className={className}
          style={{ flexShrink: 0 }}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke={iconColor}
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        </svg>
      );

    case "unstarted":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          className={className}
          style={{ flexShrink: 0 }}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke={iconColor}
            strokeWidth="1.5"
          />
        </svg>
      );

    case "started":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          className={className}
          style={{ flexShrink: 0 }}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke={iconColor}
            strokeWidth="1.5"
          />
          <path
            d="M8 2 A6 6 0 0 1 8 14 Z"
            fill={iconColor}
          />
        </svg>
      );

    case "completed":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          className={className}
          style={{ flexShrink: 0 }}
        >
          <circle
            cx="8"
            cy="8"
            r="7"
            fill={iconColor}
          />
          <path
            d="M5 8.2L7 10.2L11.2 5.8"
            stroke="var(--bg-app)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "cancelled":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          className={className}
          style={{ flexShrink: 0 }}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke={iconColor}
            strokeWidth="1.5"
          />
          <line
            x1="5"
            y1="5"
            x2="11"
            y2="11"
            stroke={iconColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    default:
      return (
        <span
          style={{
            width: `${size - 4}px`,
            height: `${size - 4}px`,
            borderRadius: "50%",
            backgroundColor: iconColor,
            display: "inline-block",
            flexShrink: 0,
          }}
          className={className}
        />
      );
  }
};

