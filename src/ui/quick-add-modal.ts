import { App, Modal } from "obsidian";

import { StatusOperations } from "../core/operations/status-operations";
import { TaskCreator } from "../core/services/task-creator";
import { TaskPlannerSettings } from "../settings/types";
import { WikilinkSuggest } from "./wikilink-suggest";

/**
 * Modal for quick task entry with styled link support.
 */
export class QuickAddModal extends Modal {
  private inputEl!: HTMLDivElement;
  private taskCreator: TaskCreator;
  private settings: TaskPlannerSettings;
  private suggest: WikilinkSuggest | null = null;
  private onTaskCreated: (() => void) | null = null;

  constructor(app: App, settings: TaskPlannerSettings) {
    super(app);
    this.settings = settings;
    this.taskCreator = new TaskCreator(app, settings);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("quick-add-modal");

    // Title
    contentEl.createDiv({ cls: "quick-add-title", text: "Quick-add Task" });

    // Contenteditable input area
    this.inputEl = contentEl.createDiv({
      cls: "quick-add-editor",
      attr: {
        contenteditable: "true",
        "data-placeholder": "Enter task... (use [[ for links)",
      },
    });

    // Set up wikilink suggestions
    this.suggest = new WikilinkSuggest(this.app, this.inputEl, () => {
      // Called when a link is inserted
    });

    // Handle keyboard events
    this.inputEl.addEventListener("keydown", this.handleKeyDown.bind(this));

    // Handle paste for smart URL handling
    this.inputEl.addEventListener("paste", this.handlePaste.bind(this));

    // Footer with hint and buttons
    const footer = contentEl.createDiv({ cls: "quick-add-footer" });

    const hint = footer.createDiv({ cls: "quick-add-hint" });
    const destination =
      this.settings.quickAdd.destination === "daily" ? "daily note" : this.settings.quickAdd.inboxFilePath;
    hint.setText(`Saving to ${destination}`);

    const buttonContainer = footer.createDiv({ cls: "quick-add-buttons" });

    const cancelBtn = buttonContainer.createEl("button", {
      text: "Cancel",
    });
    cancelBtn.addEventListener("click", () => this.close());

    const submitBtn = buttonContainer.createEl("button", {
      cls: "mod-cta",
      text: "Add task",
    });
    submitBtn.addEventListener("click", () => void this.submit());

    // Focus the input
    setTimeout(() => this.inputEl.focus(), 10);
  }

  onClose(): void {
    this.suggest?.close();
    this.contentEl.empty();
  }

  setOnTaskCreated(callback: () => void): void {
    this.onTaskCreated = callback;
  }

  private handleKeyDown(evt: KeyboardEvent): void {
    // Submit on Cmd/Ctrl+Enter
    if (evt.key === "Enter" && (evt.metaKey || evt.ctrlKey)) {
      evt.preventDefault();
      void this.submit();
      return;
    }

    // Close on Escape
    if (evt.key === "Escape") {
      setTimeout(() => {
        if (!document.querySelector(".suggestion-container")) {
          this.close();
        }
      }, 10);
    }
  }

  private handlePaste(evt: ClipboardEvent): void {
    const clipboardText = evt.clipboardData?.getData("text/plain");
    if (!clipboardText) return;

    // Check if pasting a URL
    const urlPattern = /^https?:\/\/[^\s]+$/;
    if (!urlPattern.test(clipboardText.trim())) return;

    // Check if there's selected text
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Prevent default paste
    evt.preventDefault();

    // Create a styled link span
    const linkSpan = document.createElement("span");
    linkSpan.className = "quick-add-link";
    linkSpan.dataset.url = clipboardText.trim();
    linkSpan.textContent = selectedText;
    linkSpan.contentEditable = "false";

    // Replace selection with the link span
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(linkSpan);

    // Move cursor after the link
    range.setStartAfter(linkSpan);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Converts the contenteditable content to markdown.
   * Transforms styled spans back to markdown syntax.
   */
  private getMarkdownContent(): string {
    let result = "";

    const processNode = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || "";
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;

        // Check for wikilink span
        if (el.classList.contains("quick-add-wikilink")) {
          const target = el.dataset.target || el.textContent || "";
          result += `[[${target}]]`;
          return;
        }

        // Check for external link span
        if (el.classList.contains("quick-add-link")) {
          const url = el.dataset.url || "";
          const text = el.textContent || "";
          result += `[${text}](${url})`;
          return;
        }

        // Process children for other elements
        for (const child of Array.from(el.childNodes)) {
          processNode(child);
        }
      }
    };

    for (const child of Array.from(this.inputEl.childNodes)) {
      processNode(child);
    }

    return result.trim();
  }

  private async submit(): Promise<void> {
    let text = this.getMarkdownContent();
    if (!text) {
      this.close();
      return;
    }

    // Convert @ shortcuts to Dataview attributes (e.g., @today → [due:: 2026-01-21])
    const statusOperations = new StatusOperations(this.settings);
    text = statusOperations.convertAttributes(text);

    try {
      await this.taskCreator.createTask(text);
      this.onTaskCreated?.();
      this.close();
    } catch (error) {
      const errorEl = this.contentEl.querySelector(".quick-add-error");
      if (errorEl) {
        errorEl.setText(error instanceof Error ? error.message : "Failed to create task");
      } else {
        const newErrorEl = this.contentEl.createDiv({ cls: "quick-add-error" });
        newErrorEl.setText(error instanceof Error ? error.message : "Failed to create task");
      }
    }
  }
}
