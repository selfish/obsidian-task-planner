import { Command, Workspace } from "obsidian";

import { PlanningView } from "../views";

export class OpenPlanningCommand implements Command {
  id = "open-planning";
  name = "Open planning";
  icon = "calendar-glyph";

  constructor(private workspace: Workspace) {}

  callback(): void {
    const leaf = this.workspace.getMostRecentLeaf();
    if (leaf) {
      void leaf.setViewState({ type: PlanningView.viewType });
    }
  }
}
