import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangleIcon,
  QuestionCircleIcon
} from "@renderer/components/ui/Icons";

interface HelpTooltipProps {
  content: ReactNode;
  ariaLabel?: string;
  variant?: "help" | "warning";
}

export function HelpTooltip({
  content,
  ariaLabel,
  variant = "help"
}: HelpTooltipProps) {
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const [placement, setPlacement] = useState<"center" | "start" | "end">("center");

  const updatePlacement = useCallback(() => {
    const root = rootRef.current;
    const tooltip = tooltipRef.current;
    if (!root || !tooltip) {
      return;
    }

    const viewportPadding = 12;
    const clippingContainer = root.closest(".app-main");
    const containerRect = clippingContainer?.getBoundingClientRect();
    const leftBoundary = (containerRect?.left ?? 0) + viewportPadding;
    const rightBoundary =
      (containerRect?.right ?? window.innerWidth) - viewportPadding;
    const triggerRect = root.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const centerLeft = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
    const centerRight = centerLeft + tooltipWidth;

    if (centerLeft < leftBoundary) {
      setPlacement("start");
      return;
    }
    if (centerRight > rightBoundary) {
      setPlacement("end");
      return;
    }
    setPlacement("center");
  }, []);

  useEffect(() => {
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    return () => {
      window.removeEventListener("resize", updatePlacement);
    };
  }, [updatePlacement]);

  return (
    <span
      ref={rootRef}
      className={`help-tooltip variant-${variant} placement-${placement}`}
      onMouseEnter={updatePlacement}
      onFocusCapture={updatePlacement}
      aria-label={ariaLabel}
    >
      <span className="help-tooltip-trigger" aria-hidden="true">
        {variant === "warning" ? (
          <AlertTriangleIcon size={13} />
        ) : (
          <QuestionCircleIcon size={13} />
        )}
      </span>
      <span
        ref={tooltipRef}
        id={tooltipId}
        role="tooltip"
        className="help-tooltip-content"
      >
        {content}
      </span>
    </span>
  );
}
