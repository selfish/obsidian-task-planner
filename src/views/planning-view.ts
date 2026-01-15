import { Logger } from "../types/logger";
import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { TodoIndex } from "../core/index/todo-index";
import { TaskPlannerSettings } from "../settings/types";
import { MountPlanningComponent } from "../ui/PlanningComponent";
import { TodoReportView } from "./todo-report-view";

export interface PlanningViewDeps {
  logger: Logger;
  todoIndex: TodoIndex<TFile>;
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

  async onOpen(): Promise<void> {
    this.render();
  }

  onShow(): void {
    // Refresh view when it becomes visible
    this.render();
  }

  render(): void {
    this.deps.logger.info("Rendering planning view");
    MountPlanningComponent(this.contentView, {
      deps: this.deps,
      settings: this.settings,
      app: this.app,
      onRefresh: () => this.render(),
      onOpenReport: () => this.openReport(),
    });
  }

  private openReport(): void {
    const leaf = this.app.workspace.getLeaf("tab");
    void leaf.setViewState({ type: TodoReportView.viewType });
  }
}
