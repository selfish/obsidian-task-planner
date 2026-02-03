import * as React from "react";

export type LoadLevel = "light" | "normal" | "heavy" | "overloaded";

export interface LoadIndicatorProps {
  taskCount: number;
  wipLimit: number;
  isLimited: boolean;
}

/**
 * Determines the load level based on task count and WIP limit.
 */
export function getLoadLevel(taskCount: number, wipLimit: number, isLimited: boolean): LoadLevel {
  if (!isLimited || wipLimit <= 0) {
    // No limit set - use absolute thresholds
    if (taskCount <= 3) return "light";
    if (taskCount <= 5) return "normal";
    if (taskCount <= 8) return "heavy";
    return "overloaded";
  }

  const ratio = taskCount / wipLimit;
  if (ratio <= 0.5) return "light";
  if (ratio <= 0.8) return "normal";
  if (ratio <= 1.0) return "heavy";
  return "overloaded";
}

/**
 * A visual indicator showing task load relative to WIP limit.
 * Displays as a thin progress bar with color coding:
 * - Green: light load (under 50% of limit)
 * - Yellow: normal load (50-80% of limit)
 * - Orange: heavy load (80-100% of limit)
 * - Red: overloaded (over 100% of limit)
 */
export function LoadIndicator({ taskCount, wipLimit, isLimited }: LoadIndicatorProps): React.ReactElement | null {
  // Don't show indicator if no tasks
  if (taskCount === 0) {
    return null;
  }

  const loadLevel = getLoadLevel(taskCount, wipLimit, isLimited);
  const fillPercentage = isLimited && wipLimit > 0 ? Math.min((taskCount / wipLimit) * 100, 100) : Math.min((taskCount / 10) * 100, 100);

  const tooltipText = isLimited ? `${taskCount} tasks (WIP limit: ${wipLimit})` : `${taskCount} tasks`;

  return (
    <div className={`load-indicator ${loadLevel}`} title={tooltipText} aria-label={tooltipText}>
      <div className="load-indicator-bar" style={{ width: `${fillPercentage}%` }} />
      {loadLevel === "overloaded" && <div className="load-indicator-overflow" />}
    </div>
  );
}
