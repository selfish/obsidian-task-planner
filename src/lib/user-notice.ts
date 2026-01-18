import { Notice } from "obsidian";

import { TaskPlannerError, ErrorTier } from "./errors";

/**
 * Duration in milliseconds for different error tiers
 */
const NOTICE_DURATION: Record<ErrorTier, number> = {
  CRITICAL: 10000, // 10 seconds - critical errors need attention
  HIGH: 7000,      // 7 seconds
  MEDIUM: 5000,    // 5 seconds
  LOW: 3000,       // 3 seconds
};

/**
 * Prefix for different error tiers
 */
const NOTICE_PREFIX: Record<ErrorTier, string> = {
  CRITICAL: 'Task Planner Error: ',
  HIGH: 'Task Planner: ',
  MEDIUM: 'Task Planner: ',
  LOW: '',
};

/**
 * Shows a user-friendly notice for an error using Obsidian's Notice API
 */
export function showErrorNotice(error: Error | string, tier: ErrorTier = 'MEDIUM'): void {
  let message: string;
  let actualTier: ErrorTier = tier;

  if (error instanceof TaskPlannerError) {
    message = error.message;
    actualTier = error.tier;
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = error;
  }

  const prefix = NOTICE_PREFIX[actualTier];
  const duration = NOTICE_DURATION[actualTier];

  new Notice(`${prefix}${message}`, duration);
}

/**
 * Shows a success notice
 */
export function showSuccessNotice(message: string, duration: number = 3000): void {
  new Notice(message, duration);
}

/**
 * Shows an informational notice
 */
export function showInfoNotice(message: string, duration: number = 4000): void {
  new Notice(message, duration);
}
