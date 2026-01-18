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

import { App, Plugin, PluginManifest, TFile } from "obsidian";

import {
  CompleteLineCommand,
  OpenPlanningCommand,
  OpenReportCommand,
  ToggleOngoingTodoCommand,
  ToggleTodoCommand,
} from "./commands";
import { FileTodoParser, FolderTodoParser, StatusOperations, TodoIndex } from "./core";
import { createAutoConvertExtension } from "./editor";
import { ConsoleLogger, LogLevel, ObsidianFile, saveSettingsWithRetry, showErrorNotice } from "./lib";
import { DEFAULT_SETTINGS, TaskPlannerSettings, TaskPlannerSettingsTab } from "./settings";
import { Logger } from "./types";
import { PlanningView, TodoListView, TodoReportView } from "./views";

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
    this.registerEditorExtension(createAutoConvertExtension(() => this.settings));

    this.app.workspace.onLayoutReady(async () => {
      this.loadFiles();

      if (this.app.workspace.getLeavesOfType(TodoListView.viewType).length) {
        return;
      }

      try {
        await this.app.workspace.getRightLeaf(false)?.setViewState({
          type: TodoListView.viewType,
        });
      } catch (err) {
        this.logger.error(`Failed to set view state: ${err}`);
      }
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
          void this.todoIndex.fileUpdated(new ObsidianFile(this.app, file));
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          void this.todoIndex.fileCreated(new ObsidianFile(this.app, file));
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          void this.todoIndex.fileDeleted(new ObsidianFile(this.app, file));
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
      void this.todoIndex.filesLoaded(files);
    }, 50);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function -- cleanup handled by Obsidian's Plugin base class
  onunload(): void {}

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    try {
      await saveSettingsWithRetry(() => this.saveData(this.settings));
    } catch (error) {
      this.logger.error(error instanceof Error ? error : new Error(String(error)), {
        operation: 'saveSettings',
      });
      showErrorNotice('Failed to save settings. Please try again.', 'HIGH');
      throw error;
    }
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
