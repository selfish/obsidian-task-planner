import { App, Modal, Setting, TFolder, normalizePath } from "obsidian";

import { Completion } from "../core/operations/completion";
import { isValidDueDate } from "../editor/due-date-edit";
import { FolderSuggest } from "../ui/folder-suggest";

import type { CustomAtShortcut, CustomHorizon, HorizonColor } from "./types";

/** Collection edits are drafts: cancel, Escape, and invalid input never persist. */
class CollectionEditor extends Modal {
  constructor(
    app: App,
    title: string,
    private readonly renderFields: (container: HTMLElement) => void,
    private readonly save: () => Promise<string | void>
  ) {
    super(app);
    this.setTitle(title);
  }

  onOpen(): void {
    this.contentEl.addClass("task-planner-settings-editor");
    this.renderFields(this.contentEl);
    const error = this.contentEl.createDiv({ attr: { role: "alert" } });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((button) =>
        button
          .setButtonText("Save")
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            try {
              const message = await this.save();
              if (message) error.setText(message);
              else this.close();
            } catch {
              error.setText("Could not save. Your changes are still here; try again.");
            } finally {
              button.setDisabled(false);
            }
          })
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export function editHorizon(app: App, existing: CustomHorizon | undefined, save: (draft: CustomHorizon) => Promise<void>): void {
  const draft: CustomHorizon = existing ? { ...existing } : { label: "", date: "", position: "end" };
  new CollectionEditor(
    app,
    existing ? "Edit custom horizon" : "Add custom horizon",
    (el) => {
      new Setting(el).setName("Name").addText((text) =>
        text.setValue(draft.label).onChange((value) => {
          draft.label = value.trim();
        })
      );
      new Setting(el)
        .setName("Date")
        .setDesc("Tasks dropped here receive this due date.")
        .addText((text) => {
          text.inputEl.type = "date";
          text.setValue(draft.date).onChange((value) => {
            draft.date = value;
          });
        });
      new Setting(el)
        .setName("Tag")
        .setDesc("Optional tag to add when dropping tasks here. Do not include #.")
        .addText((text) =>
          text.setValue(draft.tag ?? "").onChange((value) => {
            draft.tag = value.trim().replace(/^#/, "") || undefined;
          })
        );
      new Setting(el).setName("Position").addDropdown((dropdown) =>
        dropdown
          .addOptions({ before: "Before backlog", after: "After backlog", inline: "On its date", end: "At the end" })
          .setValue(draft.position)
          .onChange((value) => {
            draft.position = value as CustomHorizon["position"];
          })
      );
      new Setting(el).setName("Color").addDropdown((dropdown) => {
        dropdown.addOption("", "Default");
        for (const color of ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink", "accent", "success", "warning", "error"]) dropdown.addOption(color, color.charAt(0).toUpperCase() + color.slice(1));
        dropdown.setValue(draft.color ?? "").onChange((value) => {
          draft.color = (value || undefined) as HorizonColor | undefined;
        });
      });
    },
    async () => {
      if (!draft.label) return "Enter a horizon name.";
      if (!isValidDueDate(draft.date)) return "Choose a valid date.";
      if (draft.tag && /[\s#]/u.test(draft.tag)) return "Use one tag without spaces or #.";
      await save(draft);
      return undefined;
    }
  ).open();
}

export function editShortcut(app: App, existing: CustomAtShortcut | undefined, shortcuts: CustomAtShortcut[], save: (draft: CustomAtShortcut) => Promise<void>): void {
  const draft: CustomAtShortcut = existing ? { ...existing } : { keyword: "", targetAttribute: "", value: true };
  new CollectionEditor(
    app,
    existing ? "Edit custom shortcut" : "Add custom shortcut",
    (el) => {
      new Setting(el)
        .setName("Keyword")
        .setDesc("Type this after @ in a task.")
        .addText((text) =>
          text.setValue(draft.keyword).onChange((value) => {
            draft.keyword = value.trim().replace(/^@/, "").toLowerCase();
          })
        );
      new Setting(el)
        .setName("Attribute")
        .setDesc("Markdown attribute written by the shortcut.")
        .addText((text) =>
          text.setValue(draft.targetAttribute).onChange((value) => {
            draft.targetAttribute = value.trim();
          })
        );
      new Setting(el)
        .setName("Value")
        .setDesc("Use true for a flag, or enter the text to insert.")
        .addText((text) =>
          text.setValue(String(draft.value)).onChange((value) => {
            draft.value = value === "true" ? true : value;
          })
        );
    },
    async () => {
      if (!/^\w+$/.test(draft.keyword)) return "Use a keyword containing English letters, numbers, or underscores.";
      if (draft.keyword !== existing?.keyword.toLowerCase() && (["selected", "critical", "high", "medium", "low", "lowest"].includes(draft.keyword) || Completion.completeDate(draft.keyword) !== null)) return "That keyword is reserved for a built-in shortcut.";
      if (!draft.targetAttribute || /[\s[\]():]/u.test(draft.targetAttribute)) return "Use an attribute name without spaces, brackets, parentheses, or colons.";
      if (draft.value !== true && (!draft.value.trim() || /[\r\n[\]]/u.test(draft.value))) return "Enter a value without line breaks or brackets.";
      if (shortcuts.some((shortcut) => shortcut !== existing && shortcut.keyword.toLowerCase() === draft.keyword)) return "That keyword already has a custom shortcut.";
      await save(draft);
      return undefined;
    }
  ).open();
}

export function addIgnoredFolder(app: App, folders: string[], save: (folder: string) => Promise<void>): void {
  let path = "";
  new CollectionEditor(
    app,
    "Add ignored folder",
    (el) => {
      new Setting(el)
        .setName("Folder")
        .setDesc("Exclude this folder and its descendants without modifying notes.")
        .addSearch((search) => {
          new FolderSuggest(search.inputEl, app);
          search.setPlaceholder("Archive").onChange((value) => {
            path = value.trim();
          });
        });
    },
    async () => {
      if (!path || path === "/" || path.split("/").includes("..")) return "Choose a folder inside the vault, not the vault root.";
      const normalized = normalizePath(path);
      if (!(app.vault.getAbstractFileByPath(normalized) instanceof TFolder)) return "Choose an existing folder, not a file.";
      if (folders.includes(normalized)) return "That folder is already in the list.";
      await save(normalized);
      return undefined;
    }
  ).open();
}
