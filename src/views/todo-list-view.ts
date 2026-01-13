import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { Logger } from "../types/logger";
import { TaskPlannerSettings } from "../settings/types";
import { MountSidePanelComponent } from "../ui/TodoSidePanelComponent";
import { TodoIndex } from "../core/index/todo-index";

export interface TodoListViewDeps {
  logger: Logger;
}

export class TodoListView extends ItemView {
  static viewType = "task-planner.todo-list";

  constructor(
    leaf: WorkspaceLeaf,
    private deps: TodoListViewDeps,
    private todoIndex: TodoIndex<TFile>,
    private settings: TaskPlannerSettings
  ) {
    super(leaf);
  }

  getViewType(): string {
    return TodoListView.viewType;
  }

  getDisplayText(): string {
    return "Todo";
  }

  getIcon(): string {
    return "check-small";
  }

  onClose(): Promise<void> {
    return Promise.resolve();
  }

  render(): void {
    MountSidePanelComponent(this.containerEl as HTMLElement, {
      deps: {
        app: this.app,
        logger: this.deps.logger,
        todoIndex: this.todoIndex,
        settings: this.settings,
      },
    });
  }
}
