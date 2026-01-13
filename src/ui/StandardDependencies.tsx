import { App } from "obsidian";
import { ILogger } from "../domain/ILogger";
import { TaskPlannerSettings } from "../domain/TaskPlannerSettings";

export interface StandardDependencies {
  logger: ILogger;
  app: App;
  settings: TaskPlannerSettings;
}