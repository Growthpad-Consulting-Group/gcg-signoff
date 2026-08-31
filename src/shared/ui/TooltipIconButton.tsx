'use client';

import { Icon } from "@iconify/react";
import { useRef, useState, useEffect, ReactNode, CSSProperties, forwardRef } from "react";
import { createPortal } from "react-dom";

interface TooltipIconButtonProps {
  icon?: string;
  label: string | ReactNode;
  onClick?: (e: any) => void;
  // Accepted for compatibility with call sites that pass it, but unused below — the tooltip is
  // styled with the app's own design tokens (bg-surface/text-hi/app-border), which already flip
  // with the theme automatically, so there's nothing for a manual light/dark branch to do.
  mode?: "light" | "dark";
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
  position?: "top" | "bottom";
  style?: CSSProperties;
  tooltipMaxWidth?: number;
}

const TooltipIconButton = forwardRef<HTMLDivElement, TooltipIconButtonProps>((
  {
    icon,
    label,
    onClick,
    mode,
    className = "",
    children,
    disabled = false,
    position = "bottom",
    style = {},
    tooltipMaxWidth = 320,
  },
  ref
) => {
  void mode; // accepted for API compatibility with call sites that pass it; tooltip styling below uses the app's own theme tokens, which already auto-flip with dark/light, so no branching on it is needed
  const btnRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (show && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({
        top: position === "top" ? rect.top + window.scrollY : rect.bottom + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
        width: rect.width,
      });
    }
  }, [show, position]);

  // Hide tooltip on scroll
  useEffect(() => {
    if (!show) return undefined;
    const hide = () => setShow(false);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [show]);

  return (
    <>
      <div
        ref={(node) => {
          (btnRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        onClick={disabled ? undefined : onClick}
        // Visible by default (text-lo at rest, text-hi + a background on hover/focus) — a bare
        // icon with only a title attribute and no hover feedback is exactly what read as "tiny
        // and easy to miss" before; callers can still override any of this via className.
        className={`relative group z-2 rounded-lg p-2 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi focus-visible:bg-surface-2 focus-visible:text-text-hi focus:outline-none ${
          disabled ? "cursor-not-allowed opacity-40 hover:bg-transparent" : "cursor-pointer"
        } ${className}`}
        style={style}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            onClick?.(e);
          }
        }}
        onMouseEnter={() => !disabled && setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => !disabled && setShow(true)}
        onBlur={() => setShow(false)}
        aria-label={typeof label === 'string' ? label : undefined}
        aria-disabled={disabled}
      >
        {children || (icon && <Icon icon={icon} className="h-5 w-5 text-current" />)}
      </div>
      {show && typeof window !== "undefined" && createPortal(
        <div
          style={{
            position: "absolute",
            top: position === "top" ? coords.top - 8 : coords.top + 8,
            left: coords.left,
            transform: "translateX(-50%)",
            zIndex: 999999,
            pointerEvents: "none",
          }}
        >
          <div
            className="rounded-lg border border-app-border bg-surface px-3 py-2 text-center text-xs text-text-hi shadow-lg"
            style={{
              opacity: 1,
              transition: "opacity 0.2s",
              whiteSpace: "pre-line",
              maxWidth: `${tooltipMaxWidth}px`,
              minWidth: "120px",
              wordWrap: "break-word",
            }}
          >
            {label}
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

TooltipIconButton.displayName = 'TooltipIconButton';
export default TooltipIconButton;
