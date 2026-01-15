/**
 * Task Planner for Obsidian
 * Copyright (C) 2026 Selfish
 *
 * Based on "Proletarian Wizard" by cfe84 and contributors
 * Original project: https://github.com/cfe84/obsidian-pw
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * See LICENSE file for full license text.
 */

import { ConsoleLogger, LogLevel } from "./lib/logger";
import { FolderTodoParser } from "./core/parsers/folder-todo-parser";
import { FileTodoParser } from "./core/parsers/file-todo-parser";
import { Logger } from "./types/logger";
import { ObsidianFile } from "./lib/file-adapter";
import { App, Plugin, PluginManifest, TFile } from "obsidian";
import { TodoIndex } from "./core/index/todo-index";
import { ToggleTodoCommand } from "./commands/toggle-todo";
import { StatusOperations } from "./core/operations/status-operations";
import { ToggleOngoingTodoCommand } from "./commands/toggle-ongoing";
import { TaskPlannerSettingsTab } from "./settings/settings-tab";
import { DEFAULT_SETTINGS, TaskPlannerSettings } from "./settings/types";
import { CompleteLineCommand } from "./commands/complete-line";
import { PlanningView } from "./views/planning-view";
import { OpenPlanningCommand } from "./commands/open-planning";
import { TodoListView } from "./views/todo-list-view";
import { TodoReportView } from "./views/todo-report-view";
import { OpenReportCommand } from "./commands/open-report";

export default class TaskPlannerPlugin extends Plugin {
  logger: Logger = new ConsoleLogger(LogLevel.ERROR);
  settings!: TaskPlannerSettings;
  fileTodoParser!: FileTodoParser<TFile>;
  folderTodoParser!: FolderTodoParser<TFile>;
  todoIndex!: TodoIndex<TFile>;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }

  async onload(): Promise<void> {
    this.logger.info("Loading Task Planner");
    await this.loadSettings();

    this.fileTodoParser = new FileTodoParser(this.settings);
    this.folderTodoParser = new FolderTodoParser({
      fileTodoParser: this.fileTodoParser,
      logger: this.logger,
    });
    this.todoIndex = new TodoIndex(
      {
        fileTodoParser: this.fileTodoParser,
        folderTodoParser: this.folderTodoParser,
        logger: this.logger,
      },
      this.settings
    );

    const openPlanningCommand = new OpenPlanningCommand(this.app.workspace);
    const openReportCommand = new OpenReportCommand(this.app.workspace);
    const statusOperations = new StatusOperations(this.settings);

    this.addCommand(new ToggleTodoCommand(statusOperations));
    this.addCommand(new CompleteLineCommand(statusOperations));
    this.addCommand(new ToggleOngoingTodoCommand(statusOperations));
    this.addCommand(openPlanningCommand);
    this.addCommand(openReportCommand);
    this.addSettingTab(new TaskPlannerSettingsTab(this.app, this));

    this.addRibbonIcon("calendar-glyph", "Open planning", () => {
      openPlanningCommand.callback();
    });

    this.registerViews();
    this.registerEvents();

    this.app.workspace.onLayoutReady(() => {
      this.loadFiles();

      if (this.app.workspace.getLeavesOfType(TodoListView.viewType).length) {
        return;
      }

      this.app.workspace.getRightLeaf(false)?.setViewState({
        type: TodoListView.viewType,
      });
    });

    this.logger.info("Task Planner loaded");
  }

  private registerViews(): void {
    this.registerView(TodoListView.viewType, (leaf) => {
      const view = new TodoListView(leaf, { logger: this.logger }, this.todoIndex, this.settings);
      view.render();
      return view;
    });

    this.registerView(PlanningView.viewType, (leaf) => {
      const view = new PlanningView({ logger: this.logger, todoIndex: this.todoIndex }, this.settings, leaf);
      view.render();
      return view;
    });

    this.registerView(TodoReportView.viewType, (leaf) => {
      const view = new TodoReportView(
        leaf,
        {
          logger: this.logger,
          todoIndex: this.todoIndex,
          settings: this.settings,
          app: this.app,
        },
        this.settings
      );
      view.render();
      return view;
    });
  }

  private registerEvents(): void {
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.todoIndex.fileUpdated(new ObsidianFile(this.app, file));
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.todoIndex.fileCreated(new ObsidianFile(this.app, file));
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.todoIndex.fileDeleted(new ObsidianFile(this.app, file));
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile && file.extension === "md") {
          this.todoIndex.fileRenamed(oldPath, new ObsidianFile(this.app, file));
        }
      })
    );
  }

  private loadFiles(): void {
    setTimeout(() => {
      const files = this.app.vault.getMarkdownFiles().map((file) => new ObsidianFile(this.app, file));
      this.todoIndex.filesLoaded(files);
    }, 50);
  }

  onunload(): void {
    // Cleanup handled by Obsidian
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  refreshPlanningViews(): void {
    const leaves = this.app.workspace.getLeavesOfType(PlanningView.viewType);
    for (const leaf of leaves) {
      const view = leaf.view as PlanningView;
      if (view?.render) {
        view.render();
      }
    }
  }
}
