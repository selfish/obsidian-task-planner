import { App } from "obsidian";

import { TaskPlannerSettings } from "../settings/types";
import { Logger } from "../types/logger";

export interface StandardDependencies {
  logger: Logger;
  app: App;
  settings: TaskPlannerSettings;
  /** IDs of subtasks that have been promoted to their own columns (have their own due dates) */
  promotedSubtaskIds?: Set<string>;
}
