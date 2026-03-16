import * as React from "react";

export type LoadLevel = "light" | "normal" | "heavy" | "overloaded";

export interface LoadIndicatorProps {
  taskCount: number;
  wipLimit: number;
  isLimited: boolean;
}

export function getLoadLevel(taskCount: number, wipLimit: number, isLimited: boolean): LoadLevel {
  if (!isLimited || wipLimit <= 0) {
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

export function LoadIndicator({ taskCount, wipLimit, isLimited }: LoadIndicatorProps): React.ReactElement | null {
  if (taskCount === 0) return null;

  const loadLevel = getLoadLevel(taskCount, wipLimit, isLimited);
  const tooltipText = isLimited ? `${taskCount} tasks (WIP limit: ${wipLimit})` : `${taskCount} tasks`;

  return <div className={`load-indicator ${loadLevel}`} title={tooltipText} aria-label={tooltipText} />;
}
