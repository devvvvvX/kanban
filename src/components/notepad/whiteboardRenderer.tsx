import React from "react";
import type { WhiteboardElement, Point } from "./whiteboardTypes";

/**
 * Draws a single vector element onto a 2D canvas context with quadratic Bézier curve smoothing.
 */
export function drawWhiteboardElement(
  ctx: CanvasRenderingContext2D,
  el: WhiteboardElement,
  bgColor: string = "#FFFFFF"
): void {
  if (!el.points || el.points.length === 0) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (el.type === "eraser") {
    ctx.strokeStyle = bgColor;
    ctx.lineWidth = el.strokeWidth * 4;
  } else {
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.strokeWidth;
  }

  const pts = el.points;

  switch (el.type) {
    case "pen":
    case "eraser": {
      if (pts.length === 1) {
        ctx.fillStyle = el.type === "eraser" ? bgColor : el.color;
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, el.strokeWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);

      if (pts.length === 2) {
        ctx.lineTo(pts[1].x, pts[1].y);
      } else {
        // Midpoint Quadratic Bézier curve smoothing for 60fps natural curves
        for (let i = 1; i < pts.length - 1; i++) {
          const midX = (pts[i].x + pts[i + 1].x) / 2;
          const midY = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last.x, last.y);
      }
      ctx.stroke();
      break;
    }

    case "line": {
      if (pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      break;
    }

    case "arrow": {
      if (pts.length < 2) break;
      const [start, end] = pts;
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headlen = Math.max(12, el.strokeWidth * 3);

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Draw arrowhead
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headlen * Math.cos(angle - Math.PI / 6),
        end.y - headlen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headlen * Math.cos(angle + Math.PI / 6),
        end.y - headlen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
      break;
    }

    case "rect": {
      if (pts.length < 2) break;
      const [p0, p1] = pts;
      ctx.beginPath();
      ctx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
      break;
    }

    case "circle": {
      if (pts.length < 2) break;
      const [p0, p1] = pts;
      const radius = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      ctx.beginPath();
      ctx.arc(p0.x, p0.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

/**
 * Calculates the bounding box of vector elements.
 */
export function getWhiteboardBounds(
  elements: WhiteboardElement[],
  defaultWidth = 600,
  defaultHeight = 350
): { minX: number; minY: number; width: number; height: number } {
  if (!elements || elements.length === 0) {
    return { minX: 0, minY: 0, width: defaultWidth, height: defaultHeight };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    for (const pt of el.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  if (minX === Infinity) {
    return { minX: 0, minY: 0, width: defaultWidth, height: defaultHeight };
  }

  const padding = 24;
  const computedMinX = Math.max(0, minX - padding);
  const computedMinY = Math.max(0, minY - padding);
  const computedWidth = Math.max(300, maxX - computedMinX + padding);
  const computedHeight = Math.max(180, maxY - computedMinY + padding);

  return {
    minX: Math.round(computedMinX),
    minY: Math.round(computedMinY),
    width: Math.round(computedWidth),
    height: Math.round(computedHeight),
  };
}

/**
 * Generates an SVG path `d` attribute using midpoint quadratic Bézier curve interpolation.
 */
export function pointsToSvgPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} l 0.1 0.1`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Renders vector elements into React SVG nodes.
 */
export function renderElementsToSvg(
  elements: WhiteboardElement[],
  bgColor: string = "#FFFFFF"
): React.ReactNode[] {
  return elements.map((el, index) => {
    const stroke = el.type === "eraser" ? bgColor : el.color;
    const strokeWidth = el.type === "eraser" ? el.strokeWidth * 4 : el.strokeWidth;
    const pts = el.points;

    switch (el.type) {
      case "pen":
      case "eraser": {
        const pathData = pointsToSvgPath(pts);
        return (
          <path
            key={el.id || index}
            d={pathData}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      }

      case "line": {
        if (pts.length < 2) return null;
        return (
          <line
            key={el.id || index}
            x1={pts[0].x}
            y1={pts[0].y}
            x2={pts[1].x}
            y2={pts[1].y}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );
      }

      case "arrow": {
        if (pts.length < 2) return null;
        const [start, end] = pts;
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headlen = Math.max(12, strokeWidth * 3);
        const x1 = end.x - headlen * Math.cos(angle - Math.PI / 6);
        const y1 = end.y - headlen * Math.sin(angle - Math.PI / 6);
        const x2 = end.x - headlen * Math.cos(angle + Math.PI / 6);
        const y2 = end.y - headlen * Math.sin(angle + Math.PI / 6);

        return (
          <g key={el.id || index}>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <path
              d={`M ${x1} ${y1} L ${end.x} ${end.y} L ${x2} ${y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      }

      case "rect": {
        if (pts.length < 2) return null;
        const [p0, p1] = pts;
        const x = Math.min(p0.x, p1.x);
        const y = Math.min(p0.y, p1.y);
        const width = Math.abs(p1.x - p0.x);
        const height = Math.abs(p1.y - p0.y);
        return (
          <rect
            key={el.id || index}
            x={x}
            y={y}
            width={width}
            height={height}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      }

      case "circle": {
        if (pts.length < 2) return null;
        const [p0, p1] = pts;
        const radius = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        return (
          <circle
            key={el.id || index}
            cx={p0.x}
            cy={p0.y}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );
      }

      default:
        return null;
    }
  });
}
