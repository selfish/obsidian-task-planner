import { App, Notice, PluginSettingTab, type SettingControl, type SettingDefinition, type SettingDefinitionItem, type SettingDefinitionList } from "obsidian";

import { ObsidianFile } from "../lib";
import { editHorizon, editShortcut, addIgnoredFolder } from "./settings-editors";
import { DEFAULT_SETTINGS } from "./types";

import type TaskPlannerPlugin from "../main";

function valueAt(root: object, key: string): unknown {
  return key.split(".").reduce<unknown>((value, part) => (value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined), root);
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const attributeError = (value: string): string | void => {
  if (!value || /[\s[\]():]/u.test(value)) return "Use an attribute name without spaces, brackets, parentheses, or colons.";
};

/** One host-rendered, searchable surface. No legacy renderer or nested pages. */
export class TaskPlannerSettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    public plugin: TaskPlannerPlugin
  ) {
    super(app, plugin);
  }

  getControlValue(key: string): unknown {
    const value = valueAt(this.plugin.settings, key);
    return key === "firstWeekday" ? String(value) : value;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const controls = [...this.getSettingDefinitions().flatMap((item) => ("items" in item ? (item.items ?? []) : [item])), ...WEEKDAYS.map((day) => this.toggle(`horizonVisibility.show${day}`, day, ""))];
    const definition = controls.find((item) => "control" in item && item.control?.key === key);
    if (!definition || !("control" in definition) || !definition.control) throw new Error(`Unknown setting: ${key}`);
    const control = definition.control;
    if (key === "firstWeekday") value = Number(value);
    const expected = typeof valueAt(DEFAULT_SETTINGS, key);
    if (typeof value !== expected) throw new Error(`Invalid value for ${key}`);
    if (control.type === "dropdown" && !Object.prototype.hasOwnProperty.call(control.options, String(value))) throw new Error(`Invalid option for ${key}`);
    if (control.type === "number" && (typeof value !== "number" || !Number.isFinite(value) || value < (control.min ?? -Infinity) || value > (control.max ?? Infinity))) throw new Error(`Invalid number for ${key}`);
    // The host validates before calling the setter; validate here too for programmatic callers.
    if (control.validate) {
      const error = await (control.validate as (candidate: unknown) => string | void | Promise<string | void>)(value);
      if (error) throw new Error(error);
    }
    const parts = key.split(".");
    const property = parts.pop();
    const target = (parts.length ? valueAt(this.plugin.settings, parts.join(".")) : this.plugin.settings) as Record<string, unknown>;
    const previous = target[property];
    if (previous === value) return;
    target[property] = value;
    try {
      await this.persist(key === "ignoreArchivedTasks" || key.endsWith("Attribute") || key.startsWith("atShortcutSettings."));
    } catch (error) {
      target[property] = previous;
      throw error;
    }
    if (["firstWeekday", "quickAdd.destination", "quickAdd.placement", "atShortcutSettings.enableAtShortcuts", "undo.enableUndo", "undo.showUndoToast"].includes(key)) this.update();
  }

  private async persist(reindex = false): Promise<void> {
    await this.plugin.saveSettings();
    if (reindex) {
      try {
        await this.plugin.taskIndex.filesLoaded(this.app.vault.getMarkdownFiles().map((file) => new ObsidianFile(this.app, file)));
      } catch {
        new Notice("Settings saved, but tasks could not be reindexed. Reload the plugin to retry.");
      }
    }
    this.plugin.refreshPlanningViews();
  }

  private async changeList<T>(list: T[], change: () => void, reindex = false): Promise<void> {
    const previous = [...list];
    change();
    try {
      await this.persist(reindex);
      this.update();
    } catch (error) {
      list.splice(0, list.length, ...previous);
      this.update();
      throw error;
    }
  }

  private listAction<T>(list: T[], change: () => void, reindex = false): void {
    void this.changeList(list, change, reindex).catch(() => new Notice("Could not save settings. Your previous values have been restored."));
  }

  private control(name: string, desc: string, control: SettingControl, aliases?: string[]): SettingDefinition {
    return { name, desc, aliases, control };
  }

  private toggle(key: string, name: string, desc: string, disabled?: () => boolean): SettingDefinition {
    return this.control(name, desc, { type: "toggle", key, defaultValue: valueAt(DEFAULT_SETTINGS, key) as boolean, disabled });
  }

  private text(key: string, name: string, desc: string, validate?: (value: string) => string | void, disabled?: () => boolean): SettingDefinition {
    return this.control(name, desc, { type: "text", key, defaultValue: valueAt(DEFAULT_SETTINGS, key) as string, validate, disabled });
  }

  private number(key: string, name: string, desc: string, min: number, max?: number, disabled?: () => boolean): SettingDefinition {
    return this.control(name, desc, {
      type: "number",
      key,
      min,
      max,
      step: 1,
      defaultValue: valueAt(DEFAULT_SETTINGS, key) as number,
      disabled,
      validate: (value) => (!Number.isInteger(value) || value < min || (max !== undefined && value > max) ? `Enter a whole number ${max === undefined ? `of at least ${min}` : `from ${min} to ${max}`}.` : undefined),
    });
  }

  private dropdown(key: string, name: string, desc: string, options: Record<string, string>): SettingDefinition {
    return this.control(name, desc, { type: "dropdown", key, options, defaultValue: String(valueAt(DEFAULT_SETTINGS, key)) });
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const s = this.plugin.settings;
    const shortcutsOff = () => !s.atShortcutSettings.enableAtShortcuts;
    const undoOff = () => !s.undo.enableUndo;
    const group = (heading: string, items: SettingDefinition[]): SettingDefinitionItem => ({ type: "group", heading, items });
    return [
      group("Planning board", [
        {
          ...this.number("maxHorizonsPerColumn", "Maximum horizons per column", "Maximum horizons stacked vertically in the future board. 0 keeps automatic layout: up to 2 normally, 3 in Future focus. Fewer may fit in a short pane. Today is unchanged.", 0, 6),
          aliases: ["stack", "rows", "layout", "density"],
        },
        this.number("dailyWipLimit", "Daily work-in-progress limit", "Highlight overloaded days. 0 disables the limit; tasks are never blocked.", 0),
        this.toggle("fuzzySearch", "Fuzzy search", "Allow approximate matches in the board's task search."),
      ]),
      group("Quick add", [
        this.dropdown("quickAdd.destination", "Destination", "Save tasks created with Quick add to an inbox file or today's daily note.", { inbox: "Inbox file", daily: "Daily note" }),
        {
          name: "Inbox file",
          desc: "Used for the Inbox file destination. A missing Markdown file is created when you add a task.",
          control: {
            type: "file",
            key: "quickAdd.inboxFilePath",
            disabled: () => s.quickAdd.destination !== "inbox",
            defaultValue: "Inbox.md",
            placeholder: "Inbox.md",
            filter: (file) => file.extension === "md",
            validate: (value) => (!value.trim() || value.startsWith("/") || value.split("/").includes("..") || !value.toLowerCase().endsWith(".md") ? "Enter a vault-relative Markdown path, for example Tasks/Inbox.md." : undefined),
          },
        },
        this.dropdown("quickAdd.placement", "Placement", "Where new tasks are inserted in the destination note.", { prepend: "Beginning of note", append: "End of note", "before-regex": "Before matching text", "after-regex": "After matching text" }),
        this.text(
          "quickAdd.locationRegex",
          "Location regex",
          "Used with Before/After matching text placement. If no match is found, append at the end.",
          (value) => {
            if (!value) return "Enter a regular expression.";
            try {
              new RegExp(value);
            } catch {
              return "Enter a valid regular expression.";
            }
            return undefined;
          },
          () => !["before-regex", "after-regex"].includes(s.quickAdd.placement)
        ),
        this.control("Task pattern", "Template for new tasks. Include {task}; {time} and {date} are optional.", {
          type: "textarea",
          key: "quickAdd.taskPattern",
          defaultValue: "- [ ] {task}",
          validate: (value) => (value.includes("{task}") ? undefined : "Include {task} so the task text is not lost."),
        }),
        this.number("quickAdd.templaterDelay", "Templater delay (ms)", "Wait before writing to a newly created daily note so its template can finish. 0 disables the wait.", 0),
      ]),
      group("Horizons", [
        this.toggle("horizonVisibility.showBacklog", "Backlog", "Show tasks without a due date."),
        this.toggle("horizonVisibility.showOverdue", "Overdue", "Show unfinished tasks whose due date has passed."),
        this.toggle("horizonVisibility.showLater", "Later", "Show tasks beyond the last visible time horizon."),
        this.dropdown("firstWeekday", "Week starts on", "The first day of your planning week.", { "1": "Monday", "2": "Tuesday", "3": "Wednesday", "4": "Thursday", "5": "Friday", "6": "Saturday", "7": "Sunday" }),
        this.weekdaySelector(),
        this.dropdown("horizonVisibility.nextWeekMode", "Next week", "Choose how the next week's days are grouped.", { "same-as-this-week": "Selected weekdays", "rolling-week": "Rolling 7 days", collapsed: "Single horizon" }),
        this.number("horizonVisibility.weeksToShow", "Weeks after next", "Additional weekly horizons beyond next week. 0 hides them.", 0, 4),
        this.number("horizonVisibility.monthsToShow", "Months ahead", "Upcoming monthly horizons after the visible weeks. 0 hides them.", 0, 3),
        this.toggle("horizonVisibility.showQuarters", "Quarters", "Show the remaining quarters of this year after visible months."),
        this.toggle("horizonVisibility.showNextYear", "Next year", "Show one horizon for next year."),
      ]),
      this.horizonList(),
      group("Task attributes", [
        this.text("dueDateAttribute", "Due date attribute", "Markdown field used for due dates, for example [due:: 2026-10-20]. Existing note text is not renamed.", attributeError),
        this.text("completedDateAttribute", "Completed date attribute", "Markdown field written when completing a task. Existing note text is not renamed.", attributeError),
        this.text("selectedAttribute", "Pinned attribute", "Markdown field used to pin a task. Existing note text is not renamed.", attributeError),
      ]),
      group("@ shortcuts", [
        this.toggle("atShortcutSettings.enableAtShortcuts", "Enable @-shortcuts", "Expand shortcuts with Complete line attributes or automatically when leaving a line."),
        this.toggle("autoConvertAttributes", "Auto-convert", "Convert shortcuts when leaving a task line. Turn off to use only the command.", shortcutsOff),
        this.toggle("atShortcutSettings.enableDateShortcuts", "Date shortcuts", "Enable @today, @tomorrow, weekday shortcuts and the @date picker.", shortcutsOff),
        this.toggle("atShortcutSettings.enablePriorityShortcuts", "Priority shortcuts", "Enable @critical, @high, @medium, @low and @lowest.", shortcutsOff),
        this.toggle("atShortcutSettings.enableBuiltinShortcuts", "Pinned shortcut", "Enable @selected to pin tasks with your configured pinned attribute.", shortcutsOff),
      ]),
      this.shortcutList(),
      group("Indexing", [this.toggle("ignoreArchivedTasks", "Exclude ignored folders", "Skip the folders listed below and their descendants. Changes reindex the vault immediately; notes are never modified.")]),
      this.folderList(),
      group("Undo", [
        this.toggle("undo.enableUndo", "Enable undo for drag-and-drop", "Undo board moves with Ctrl/Cmd+Z. Note-editor undo is unaffected."),
        this.number("undo.undoHistorySize", "Undo history size", "Maximum board moves kept in memory per planning view.", 1, undefined, undoOff),
        this.number("undo.undoHistoryMaxAgeSeconds", "Undo history age (seconds)", "Forget board moves after this time. 0 expires history immediately.", 0, undefined, undoOff),
        this.toggle("undo.showUndoToast", "Show undo notification", "Offer an Undo button after moving tasks.", undoOff),
        this.number("undo.undoToastDurationMs", "Undo notification duration (ms)", "How long the Undo notification stays visible. 0 dismisses it immediately.", 0, undefined, () => undoOff() || !s.undo.showUndoToast),
      ]),
      group("Follow-up tasks", [
        this.text("followUp.textPrefix", "Follow-up prefix", "Text placed before the original task's title. May be empty."),
        this.toggle("followUp.copyTags", "Copy tags", "Include the original task's tags in a follow-up."),
        this.toggle("followUp.copyPriority", "Copy priority", "Include the original task's priority in a follow-up."),
      ]),
    ];
  }

  private weekdaySelector(): SettingDefinition {
    return {
      name: "Visible days",
      desc: "Days shown this week and in next week's selected-days mode.",
      aliases: ["weekdays", ...WEEKDAYS],
      render: (setting) => {
        setting.setClass("th-weekday-setting");
        const grid = setting.controlEl.createDiv({ cls: "th-weekday-grid", attr: { role: "group", "aria-label": "Visible weekdays" } });
        const first = this.plugin.settings.firstWeekday - 1;
        const days = [...WEEKDAYS.slice(first), ...WEEKDAYS.slice(0, first)];
        let saving = false;
        for (const day of days) {
          const key = `horizonVisibility.show${day}`;
          const button = grid.createEl("button", { cls: "th-weekday-btn", attr: { type: "button", "aria-label": day } });
          button.createSpan({ cls: "th-weekday-btn-label", text: day.slice(0, 3) });
          button.createSpan({ cls: "th-weekday-btn-led", attr: { "aria-hidden": "true" } });
          const sync = () => {
            const selected = Boolean(this.getControlValue(key));
            button.classList.toggle("th-weekday-btn--active", selected);
            button.setAttribute("aria-pressed", String(selected));
          };
          sync();
          button.addEventListener("click", () => {
            if (saving) return;
            saving = true;
            grid.setAttribute("aria-busy", "true");
            void this.setControlValue(key, !this.getControlValue(key))
              .catch(() => new Notice("Could not save settings. Your previous values have been restored."))
              .finally(() => {
                saving = false;
                grid.removeAttribute("aria-busy");
                sync();
              });
          });
        }
      },
    };
  }

  private horizonList(): SettingDefinitionList {
    const list = this.plugin.settings.customHorizons;
    const edit = (index?: number) =>
      editHorizon(this.app, index === undefined ? undefined : list[index], async (draft) => {
        await this.changeList(list, () => {
          if (index === undefined) list.push(draft);
          else list[index] = draft;
        });
      });
    return {
      type: "list",
      heading: "Custom horizons",
      emptyState: "No custom horizons. Add one for a milestone, project, or fixed date.",
      items: list.map((horizon, index) => ({
        name: horizon.label,
        desc: `${horizon.date}${horizon.tag ? ` · #${horizon.tag}` : ""} · ${horizon.position === "inline" ? "On its date" : horizon.position === "end" ? "At the end" : `${horizon.position === "before" ? "Before" : "After"} backlog`}`,
        action: () => edit(index),
      })),
      addItem: { name: "Add custom horizon", action: () => edit() },
      onDelete: (index) => {
        this.listAction(list, () => list.splice(index, 1));
      },
      onReorder: (from, to) => {
        this.listAction(list, () => list.splice(to, 0, ...list.splice(from, 1)));
      },
    };
  }

  private shortcutList(): SettingDefinitionList {
    const list = this.plugin.settings.atShortcutSettings.customShortcuts;
    const edit = (index?: number) =>
      editShortcut(this.app, index === undefined ? undefined : list[index], list, async (draft) => {
        await this.changeList(
          list,
          () => {
            if (index === undefined) list.push(draft);
            else list[index] = draft;
          },
          true
        );
      });
    return {
      type: "list",
      heading: "Custom shortcuts",
      emptyState: "No custom shortcuts. Add a keyword that expands into a Markdown attribute.",
      items: list.map((shortcut, index) => ({ name: `@${shortcut.keyword}`, desc: `[${shortcut.targetAttribute}:: ${shortcut.value}]`, action: () => edit(index), disabled: () => !this.plugin.settings.atShortcutSettings.enableAtShortcuts })),
      addItem: { name: "Add custom shortcut", action: () => edit() },
      onDelete: (index) => {
        this.listAction(list, () => list.splice(index, 1), true);
      },
      onReorder: (from, to) => {
        this.listAction(list, () => list.splice(to, 0, ...list.splice(from, 1)), true);
      },
    };
  }

  private folderList(): SettingDefinitionList {
    const list = this.plugin.settings.ignoredFolders;
    return {
      type: "list",
      heading: "Ignored folders",
      emptyState: "No folders excluded. Folder exclusions never delete or edit notes.",
      items: list.map((folder) => ({ name: folder, desc: "This folder and its descendants" })),
      addItem: {
        name: "Add ignored folder",
        action: () =>
          addIgnoredFolder(this.app, list, async (folder) => {
            await this.changeList(list, () => list.push(folder), true);
          }),
      },
      onDelete: (index) => {
        this.listAction(list, () => list.splice(index, 1), true);
      },
    };
  }
}
