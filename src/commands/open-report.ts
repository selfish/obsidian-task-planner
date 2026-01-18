import { Command, Workspace } from "obsidian";
import { TodoReportView } from "../views";

export class OpenReportCommand implements Command {
  id = "open-report";
  name = "Open todo report";
  icon = "list-checks";

  constructor(private workspace: Workspace) {}

  callback(): void {
    const leaf = this.workspace.getMostRecentLeaf();
    if (leaf) {
      void leaf.setViewState({ type: TodoReportView.viewType });
    }
  }
}
