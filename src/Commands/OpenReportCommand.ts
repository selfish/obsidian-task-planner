import { Command, Workspace } from "obsidian";
import { TodoReportView } from "../Views/TodoReportView";

export class OpenReportCommand implements Command {
  id = "task-planner.open-report";
  name = "Open todo report";
  icon = "list-checks";

  constructor(private workspace: Workspace) {}

  callback(): void {
    const leaf = this.workspace.getMostRecentLeaf();
    if (leaf) {
      leaf.setViewState({ type: TodoReportView.viewType });
    }
  }
}
