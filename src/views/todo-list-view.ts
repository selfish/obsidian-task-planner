import { ItemView, TFile, WorkspaceLeaf } from "obsidian";

import { TodoIndex } from "../core";
import { TaskPlannerSettings } from "../settings";
import { Logger } from "../types";
import { mountSidePanelComponent } from "../ui/todo-side-panel-component";

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
    return "Today Focus";
  }

  getIcon(): string {
    return "check-small";
  }

  onClose(): Promise<void> {
    return Promise.resolve();
  }

  render(): void {
    mountSidePanelComponent(this.containerEl, {
      deps: {
        app: this.app,
        logger: this.deps.logger,
        todoIndex: this.todoIndex,
        settings: this.settings,
      },
    });
  }
}
