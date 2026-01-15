import { ItemView, WorkspaceLeaf } from "obsidian";
import { TaskPlannerSettings } from "../settings/types";
import { MountTodoReportComponent, TodoReportComponentDeps } from "../ui/TodoReportComponent";

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
    });
  }
}
