import { Root } from "react-dom/client";

import { ItemView, TFile, WorkspaceLeaf } from "obsidian";

import { TaskIndex } from "../core";
import { TaskPlannerSettings } from "../settings";
import { Logger } from "../types";
import { mountSidePanelComponent } from "../ui/task-side-panel-component";

export interface TodoListViewDeps {
  logger: Logger;
}

export class TodoListView extends ItemView {
  static viewType = "task-planner.todo-list";
  private root?: Root;

  constructor(
    leaf: WorkspaceLeaf,
    private deps: TodoListViewDeps,
    private taskIndex: TaskIndex<TFile>,
    private settings: TaskPlannerSettings
  ) {
    super(leaf);
  }

  getViewType(): string {
    return TodoListView.viewType;
  }

  getDisplayText(): string {
    return "Today focus";
  }

  getIcon(): string {
    return "check-small";
  }

  onClose(): Promise<void> {
    this.root?.unmount();
    this.root = undefined;
    return Promise.resolve();
  }

  render(): void {
    this.root = mountSidePanelComponent(
      this.containerEl,
      {
        deps: {
          app: this.app,
          logger: this.deps.logger,
          taskIndex: this.taskIndex,
          settings: this.settings,
        },
      },
      this.root
    );
  }
}
