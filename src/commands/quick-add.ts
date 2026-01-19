import { Command, Workspace } from "obsidian";

import { PlanningView } from "../views";

export class QuickAddCommand implements Command {
  id = "quick-add-task";
  name = "Quick add task";
  icon = "plus";

  constructor(private workspace: Workspace) {}

  callback(): void {
    // Check if planning view is already open
    const leaves = this.workspace.getLeavesOfType(PlanningView.viewType);

    if (leaves.length > 0) {
      // Planning view is open, focus it and trigger quick add
      const leaf = leaves[0];
      this.workspace.setActiveLeaf(leaf, { focus: true });

      // Dispatch a custom event to trigger quick add focus
      setTimeout(() => {
        const container = leaf.view.containerEl;
        const quickAddBtn = container.querySelector(".quick-add-input, .settings-btn[aria-label='Quick add task']");
        if (quickAddBtn instanceof HTMLElement) {
          quickAddBtn.click();
        }
      }, 50);
    } else {
      // Open planning view first, then trigger quick add
      const leaf = this.workspace.getMostRecentLeaf();
      if (leaf) {
        void leaf.setViewState({ type: PlanningView.viewType }).then(() => {
          setTimeout(() => {
            const container = leaf.view.containerEl;
            const quickAddBtn = container.querySelector(".settings-btn[aria-label='Quick add task']");
            if (quickAddBtn instanceof HTMLElement) {
              quickAddBtn.click();
            }
          }, 100);
        });
      }
    }
  }
}
