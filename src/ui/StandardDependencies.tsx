import { App } from "obsidian";
import { Logger } from "../types/logger";
import { TaskPlannerSettings } from "../settings/types";

export interface StandardDependencies {
  logger: Logger;
  app: App;
  settings: TaskPlannerSettings;
}