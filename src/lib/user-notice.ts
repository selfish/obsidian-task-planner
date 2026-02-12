import { Notice } from "obsidian";

import { TaskPlannerError, ErrorTier } from "./errors";

const NOTICE_DURATION: Record<ErrorTier, number> = {
  CRITICAL: 10000,
  HIGH: 7000,
  MEDIUM: 5000,
  LOW: 3000,
};

const NOTICE_PREFIX: Record<ErrorTier, string> = {
  CRITICAL: "Task Planner Error: ",
  HIGH: "Task Planner: ",
  MEDIUM: "Task Planner: ",
  LOW: "",
};

export function showErrorNotice(error: Error | string, tier: ErrorTier = "MEDIUM"): void {
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

  new Notice(`${NOTICE_PREFIX[actualTier]}${message}`, NOTICE_DURATION[actualTier]);
}

export function showSuccessNotice(message: string, duration: number = 3000): void {
  new Notice(message, duration);
}

export function showInfoNotice(message: string, duration: number = 4000): void {
  new Notice(message, duration);
}
