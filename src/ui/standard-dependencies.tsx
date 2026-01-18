import { App } from "obsidian";

import { TaskPlannerSettings } from "../settings/types";
import { Logger } from "../types/logger";

export interface StandardDependencies {
  logger: Logger;
  app: App;
  settings: TaskPlannerSettings;
}
