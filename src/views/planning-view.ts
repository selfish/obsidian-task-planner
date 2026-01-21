import { ItemView, TFile, WorkspaceLeaf } from "obsidian";

import { TodoIndex } from "../core";
import { TaskPlannerSettings } from "../settings";
import { Logger } from "../types";
import { TodoReportView } from "./todo-report-view";
import { mountPlanningComponent } from "../ui/planning-component";

export interface PlanningViewDeps {
  logger: Logger;
  todoIndex: TodoIndex<TFile>;
  onQuickAdd?: () => void;
}

export class PlanningView extends ItemView {
  static viewType = "task-planner.planning";
  private contentView: HTMLDivElement;

  constructor(
    private deps: PlanningViewDeps,
    private settings: TaskPlannerSettings,
    leaf: WorkspaceLeaf
  ) {
    super(leaf);
    this.contentView = this.containerEl.getElementsByClassName("view-content")[0] as HTMLDivElement;
  }

  getViewType(): string {
    return PlanningView.viewType;
  }

  getDisplayText(): string {
    return "Planning";
  }

  getIcon(): string {
    return "calendar-glyph";
  }

  onOpen(): Promise<void> {
    this.render();
    return Promise.resolve();
  }

  onShow(): void {
    this.render();
  }

  render(): void {
    this.deps.logger.info("Rendering planning view");
    mountPlanningComponent(this.contentView, {
      deps: this.deps,
      settings: this.settings,
      app: this.app,
      onRefresh: () => this.render(),
      onOpenReport: () => {
        void this.openReport();
      },
      onQuickAdd: this.deps.onQuickAdd,
    });
  }

  private async openReport(): Promise<void> {
    const leaf = this.app.workspace.getLeaf("tab");
    try {
      await leaf.setViewState({ type: TodoReportView.viewType });
    } catch (err) {
      this.deps.logger.error(`Failed to open report view: ${err}`);
    }
  }
}
