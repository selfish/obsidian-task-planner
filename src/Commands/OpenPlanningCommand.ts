import { Command, Workspace } from "obsidian";
import { PlanningView } from "../Views/PlanningView";

export class OpenPlanningCommand implements Command {
  id = "task-planner.open-planning";
  name = "Open planning";
  icon = "calendar-glyph";

  constructor(private workspace: Workspace) {}

  callback(): void {
    const leaf = this.workspace.getMostRecentLeaf();
    if (leaf) {
      leaf.setViewState({ type: PlanningView.viewType });
    }
  }
}
