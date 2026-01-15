import { ItemView, WorkspaceLeaf } from "obsidian";
import { TaskPlannerSettings } from "../settings/types";
import { MountTodoReportComponent, TodoReportComponentDeps } from "../ui/TodoReportComponent";
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

  async onOpen(): Promise<void> {
    this.render();
  }

  onClose(): Promise<void> {
    return Promise.resolve();
  }

  render(): void {
    MountTodoReportComponent(this.containerEl, {
      deps: {
        logger: this.deps.logger,
        todoIndex: this.deps.todoIndex,
        app: this.app,
        settings: this.settings,
      },
      onOpenPlanning: () => this.openPlanning(),
    });
  }

  private openPlanning(): void {
    const leaf = this.app.workspace.getLeaf("tab");
    void leaf.setViewState({ type: PlanningView.viewType });
  }
}
