import { Root } from "react-dom/client";

import { ItemView, Platform, WorkspaceLeaf } from "obsidian";

import { TaskPlannerSettings } from "../settings";
import { PlanningView } from "./planning-view";
import { mountTaskReportComponent, TaskReportComponentDeps } from "../ui/task-report-component";

export class TodoReportView extends ItemView {
  static viewType = "task-planner.report";
  private root?: Root;

  constructor(
    leaf: WorkspaceLeaf,
    private deps: TaskReportComponentDeps,
    private settings: TaskPlannerSettings
  ) {
    super(leaf);
  }

  getViewType(): string {
    return TodoReportView.viewType;
  }

  getDisplayText(): string {
    return "Report";
  }

  getIcon(): string {
    return "list-checks";
  }

  onOpen(): Promise<void> {
    this.render();
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.root?.unmount();
    this.root = undefined;
    return Promise.resolve();
  }

  render(): void {
    this.root = mountTaskReportComponent(
      this.containerEl,
      {
        deps: {
          logger: this.deps.logger,
          taskIndex: this.deps.taskIndex,
          app: this.app,
          settings: this.settings,
        },
        onOpenPlanning: () => {
          void this.openPlanning();
        },
      },
      this.root
    );
  }

  private async openPlanning(): Promise<void> {
    const leaf = this.app.workspace.getLeaf(Platform.isMobile ? false : "tab");
    try {
      await leaf.setViewState({ type: PlanningView.viewType });
    } catch (err) {
      this.deps.logger.error(`Failed to open planning view: ${err}`);
    }
  }
}
