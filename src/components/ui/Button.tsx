import React, { forwardRef } from "react";
import { RotateCw } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPlacement?: "left" | "right";
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      icon,
      iconPlacement = "left",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      className = "",
      type = "button",
      ...rest
    },
    ref
  ) => {
    const isIconOnly = !children && Boolean(icon);
    const variantClass = `btn-${variant}`;
    const sizeClass = isIconOnly ? `btn-icon btn-${size}` : `btn-${size}`;
    const fullWidthClass = fullWidth ? "btn-full" : "";

    const combinedClassName = [
      "btn",
      variantClass,
      sizeClass,
      fullWidthClass,
      loading ? "loading" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading}
        className={combinedClassName}
        {...rest}
      >
        {loading ? (
          <>
            <RotateCw size={size === "sm" ? 12 : 14} className="spin-animation" />
            {children && <span>{children}</span>}
          </>
        ) : (
          <>
            {icon && iconPlacement === "left" && icon}
            {children && <span>{children}</span>}
            {icon && iconPlacement === "right" && icon}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
