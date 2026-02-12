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

import { App, Platform, Plugin, PluginManifest, TFile } from "obsidian";

import { CompleteLineCommand, OpenPlanningCommand, OpenReportCommand, QuickAddCommand, ToggleOngoingTaskCommand, ToggleTaskCommand } from "./commands";
import { FileTaskParser, FolderTaskParser, StatusOperations, TaskIndex } from "./core";
import { createAutoConvertExtension } from "./editor";
import { ConsoleLogger, LogLevel, ObsidianFile, saveSettingsWithRetry, showErrorNotice, showInfoNotice } from "./lib";
import { DEFAULT_SETTINGS, TaskPlannerSettings } from "./settings";
import { LazySettingsTab } from "./settings/settings-tab-lazy";
import { Logger } from "./types";
// OnboardingModal is lazy-loaded since it's only shown once
import { QuickAddModal } from "./ui/quick-add-modal";
import { PlanningView, TodoListView, TodoReportView } from "./views";

export default class TaskPlannerPlugin extends Plugin {
  logger: Logger = new ConsoleLogger(LogLevel.ERROR);
  settings!: TaskPlannerSettings;
  fileTaskParser!: FileTaskParser<TFile>;
  folderTaskParser!: FolderTaskParser<TFile>;
  taskIndex!: TaskIndex<TFile>;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }

  async onload(): Promise<void> {
    this.logger.info("Loading Task Planner");
    await this.loadSettings();

    this.fileTaskParser = new FileTaskParser(this.settings);
    this.folderTaskParser = new FolderTaskParser({
      fileTaskParser: this.fileTaskParser,
      logger: this.logger,
    });
    this.taskIndex = new TaskIndex(
      {
        fileTaskParser: this.fileTaskParser,
        folderTaskParser: this.folderTaskParser,
        logger: this.logger,
      },
      this.settings
    );

    const openPlanningCommand = new OpenPlanningCommand(this.app.workspace);
    const openReportCommand = new OpenReportCommand(this.app.workspace);
    const quickAddCommand = new QuickAddCommand(() => this.openQuickAddModal());
    const statusOperations = new StatusOperations(this.settings);

    this.addCommand(new ToggleTaskCommand(statusOperations));
    this.addCommand(new CompleteLineCommand(statusOperations));
    this.addCommand(new ToggleOngoingTaskCommand(statusOperations));
    this.addCommand(openPlanningCommand);
    this.addCommand(openReportCommand);
    this.addCommand(quickAddCommand);
    this.addSettingTab(new LazySettingsTab(this.app, this));

    this.addRibbonIcon("calendar-glyph", "Open planning", () => {
      openPlanningCommand.callback();
    });

    this.registerViews();
    this.registerEvents();
    this.registerEditorExtension(createAutoConvertExtension(() => this.settings));
    this.registerUriHandler();

    this.app.workspace.onLayoutReady(async () => {
      this.loadFiles();

      // Show onboarding modal for first-time users
      if (!this.settings.hasSeenOnboarding) {
        void this.showOnboardingModal();
      }

      // Warn about native menus (icons won't show in context menus)
      this.checkNativeMenusSetting();

      if (this.app.workspace.getLeavesOfType(TodoListView.viewType).length) {
        return;
      }

      if (!Platform.isMobile) {
        try {
          await this.app.workspace.getRightLeaf(false)?.setViewState({
            type: TodoListView.viewType,
          });
        } catch (err) {
          this.logger.error(`Failed to set view state: ${err}`);
        }
      }
    });

    this.logger.info("Task Planner loaded");
  }

  private registerViews(): void {
    this.registerView(TodoListView.viewType, (leaf) => {
      const view = new TodoListView(leaf, { logger: this.logger }, this.taskIndex, this.settings);
      view.render();
      return view;
    });

    this.registerView(PlanningView.viewType, (leaf) => {
      const view = new PlanningView(
        {
          logger: this.logger,
          taskIndex: this.taskIndex,
          onQuickAdd: () => this.openQuickAddModal(),
        },
        this.settings,
        leaf
      );
      view.render();
      return view;
    });

    this.registerView(TodoReportView.viewType, (leaf) => {
      const view = new TodoReportView(
        leaf,
        {
          logger: this.logger,
          taskIndex: this.taskIndex,
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
          void this.taskIndex.fileUpdated(new ObsidianFile(this.app, file));
        }
      })
    );

    // Note: 'create' event fires for every existing file during initial load.
    // Skip processing until workspace is ready to avoid blocking startup.
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (!this.app.workspace.layoutReady) return;
        if (file instanceof TFile && file.extension === "md") {
          void this.taskIndex.fileCreated(new ObsidianFile(this.app, file));
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          void this.taskIndex.fileDeleted(new ObsidianFile(this.app, file));
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile && file.extension === "md") {
          void this.taskIndex.fileRenamed(oldPath, new ObsidianFile(this.app, file));
        }
      })
    );

    // Listen to metadata cache changes (e.g., frontmatter updates)
    // This ensures shouldIgnore() reflects the latest frontmatter values
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          void this.taskIndex.fileUpdated(new ObsidianFile(this.app, file));
        }
      })
    );
  }

  private loadFiles(): void {
    const files = this.app.vault.getMarkdownFiles().map((file) => new ObsidianFile(this.app, file));
    void this.taskIndex.filesLoaded(files);
  }

  private registerUriHandler(): void {
    this.registerObsidianProtocolHandler("task-planner-quick-add", () => {
      this.openQuickAddModal();
    });

    this.registerObsidianProtocolHandler("task-planner-planning", () => {
      void this.openPlanningView();
    });
  }

  async openPlanningView(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(PlanningView.viewType);
    if (existingLeaves.length > 0) {
      // Focus existing planning view
      await this.app.workspace.revealLeaf(existingLeaves[0]);
      return;
    }

    // Open new planning view in a tab
    try {
      const leaf = this.app.workspace.getLeaf(Platform.isMobile ? false : "tab");
      await leaf.setViewState({ type: PlanningView.viewType });
      await this.app.workspace.revealLeaf(leaf);
    } catch (err) {
      this.logger.error(`Failed to open planning view: ${err}`);
    }
  }

  openQuickAddModal(): void {
    const modal = new QuickAddModal(this.app, this.settings);
    modal.setOnTaskCreated(() => {
      this.refreshPlanningViews();
    });
    modal.open();
  }

  private async showOnboardingModal(): Promise<void> {
    // Lazy-load onboarding modal since it's only shown once
    const { OnboardingModal } = await import("./ui/onboarding-modal");
    const modal = new OnboardingModal(this.app, this.settings, (addedExamples: boolean) => {
      this.settings.hasSeenOnboarding = true;
      void this.saveSettings().then(() => {
        if (addedExamples) {
          // Refresh planning views to show the newly added example tasks
          this.refreshPlanningViews();
        }
      });
    });
    modal.open();
  }

  private checkNativeMenusSetting(): void {
    if (this.settings.hasDismissedNativeMenusWarning) return;

    // Check if native menus are enabled (Obsidian internal config)
    const vaultConfig = this.app.vault as { getConfig?: (key: string) => unknown };
    if (typeof vaultConfig.getConfig !== "function") return;

    const nativeMenus = vaultConfig.getConfig("nativeMenus");
    if (nativeMenus) {
      showInfoNotice(
        "Task Planner: For the best experience with context menu icons, disable 'Native menus' in Settings → Appearance.",
        0 // Stay until dismissed
      );
      // Mark as dismissed so we don't show again
      this.settings.hasDismissedNativeMenusWarning = true;
      void this.saveSettings();
    }
  }

  onunload(): void {}

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    try {
      await saveSettingsWithRetry(() => this.saveData(this.settings));
    } catch (error) {
      this.logger.error(error instanceof Error ? error : new Error(String(error)), {
        operation: "saveSettings",
      });
      showErrorNotice("Failed to save settings. Please try again.", "HIGH");
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
