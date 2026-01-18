import { ItemView, WorkspaceLeaf } from "obsidian";
import { TaskPlannerSettings } from "../settings";
import { mountTodoReportComponent, TodoReportComponentDeps } from "../ui/todo-report-component";
import { PlanningView } from "./planning-view";

export class TodoReportView extends ItemView {
  static viewType = "task-planner.report";

  constructor(
    leaf: WorkspaceLeaf,
    private deps: TodoReportComponentDeps,
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
    return Promise.resolve();
  }

  render(): void {
    mountTodoReportComponent(this.containerEl, {
      deps: {
        logger: this.deps.logger,
        todoIndex: this.deps.todoIndex,
        app: this.app,
        settings: this.settings,
      },
      onOpenPlanning: () => this.openPlanning(),
    });
  }

  private async openPlanning(): Promise<void> {
    const leaf = this.app.workspace.getLeaf("tab");
    try {
      await leaf.setViewState({ type: PlanningView.viewType });
    } catch (err) {
      this.deps.logger.error(`Failed to open planning view: ${err}`);
    }
  }
}
