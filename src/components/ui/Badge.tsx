import React, { forwardRef } from "react";

export type BadgeVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "subtle";

export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  dotColor?: string;
  icon?: React.ReactNode;
  pill?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = "default",
      size = "md",
      dot = false,
      dotColor,
      icon,
      pill = false,
      children,
      className = "",
      ...rest
    },
    ref
  ) => {
    const variantClass = `badge-${variant}`;
    const sizeClass = `badge-${size}`;
    const pillClass = pill ? "badge-pill" : "";

    const combinedClassName = [
      "badge",
      variantClass,
      sizeClass,
      pillClass,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <span ref={ref} className={combinedClassName} {...rest}>
        {dot && (
          <span
            className="badge-dot"
            style={dotColor ? { backgroundColor: dotColor } : undefined}
          />
        )}
        {icon && <span className="badge-icon">{icon}</span>}
        {children && <span>{children}</span>}
      </span>
    );
  }
);

Badge.displayName = "Badge";
