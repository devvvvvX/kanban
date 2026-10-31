import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  badge?: string | number;
  disabled?: boolean;
}

export interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  labelPrefix?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
  menuPlacement?: "left" | "right";
  ariaLabel?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  labelPrefix,
  size = "sm",
  disabled = false,
  fullWidth = false,
  className = "",
  style = {},
  menuPlacement = "left",
  ariaLabel,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (!isOpen) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setIsOpen(true);
          const idx = options.findIndex((opt) => opt.value === value);
          setHighlightedIndex(idx >= 0 ? idx : 0);
        }
        return;
      }

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(false);
          break;
        case "ArrowDown": {
          e.preventDefault();
          let nextIdx = (highlightedIndex + 1) % options.length;
          while (options[nextIdx]?.disabled && nextIdx !== highlightedIndex) {
            nextIdx = (nextIdx + 1) % options.length;
          }
          setHighlightedIndex(nextIdx);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          let prevIdx = (highlightedIndex - 1 + options.length) % options.length;
          while (options[prevIdx]?.disabled && prevIdx !== highlightedIndex) {
            prevIdx = (prevIdx - 1 + options.length) % options.length;
          }
          setHighlightedIndex(prevIdx);
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          if (highlightedIndex >= 0 && options[highlightedIndex] && !options[highlightedIndex].disabled) {
            onChange(options[highlightedIndex].value);
            setIsOpen(false);
          }
          break;
        }
        case "Tab":
          setIsOpen(false);
          break;
      }
    },
    [disabled, isOpen, highlightedIndex, options, value, onChange]
  );

  const containerClasses = [
    "custom-select-container",
    fullWidth ? "full-width" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const triggerClasses = [
    "custom-select-trigger",
    size,
    isOpen ? "open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const popoverClasses = [
    "custom-select-popover",
    `placement-${menuPlacement}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={containerRef} className={containerClasses} style={style}>
      {/* Trigger Button */}
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || labelPrefix || placeholder}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            const idx = options.findIndex((opt) => opt.value === value);
            setHighlightedIndex(idx >= 0 ? idx : 0);
          }
        }}
        onKeyDown={handleKeyDown}
        className={triggerClasses}
      >
        <span className="custom-select-label-wrap">
          {labelPrefix && (
            <span className="custom-select-prefix">{labelPrefix}</span>
          )}

          {selectedOption ? (
            <>
              {selectedOption.color && (
                <span
                  className="custom-select-dot"
                  style={{
                    backgroundColor: selectedOption.color,
                    boxShadow: `0 0 6px ${selectedOption.color}50`,
                  }}
                />
              )}
              {selectedOption.icon && (
                <span className="custom-select-icon">
                  {selectedOption.icon}
                </span>
              )}
              <span className="custom-select-text">
                {selectedOption.label}
              </span>
              {selectedOption.badge !== undefined && (
                <span className="custom-select-badge">
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span className="custom-select-placeholder">{placeholder}</span>
          )}
        </span>

        <ChevronDown
          size={14}
          className={`custom-select-chevron ${isOpen ? "open" : ""}`}
        />
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div ref={menuRef} role="listbox" tabIndex={-1} className={popoverClasses}>
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isHighlighted = idx === highlightedIndex;

            const itemClasses = [
              "custom-select-item",
              size,
              isSelected ? "selected" : "",
              isHighlighted ? "highlighted" : "",
              option.disabled ? "disabled" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onClick={() => {
                  if (!option.disabled) {
                    onChange(option.value);
                    setIsOpen(false);
                  }
                }}
                onMouseEnter={() => {
                  if (!option.disabled) setHighlightedIndex(idx);
                }}
                className={itemClasses}
              >
                <div className="custom-select-item-content">
                  {option.color && (
                    <span
                      className="custom-select-dot"
                      style={{
                        backgroundColor: option.color,
                        boxShadow: `0 0 4px ${option.color}60`,
                      }}
                    />
                  )}
                  {option.icon && (
                    <span className="custom-select-icon">
                      {option.icon}
                    </span>
                  )}
                  <span className="custom-select-text">
                    {option.label}
                  </span>
                </div>

                <div className="custom-select-item-meta">
                  {option.badge !== undefined && (
                    <span className="custom-select-badge">
                      {option.badge}
                    </span>
                  )}
                  {isSelected && (
                    <Check size={14} className="custom-select-check" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
