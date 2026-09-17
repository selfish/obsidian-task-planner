import { App, Editor, Modal, Notice, TFile } from "obsidian";

import { Completion } from "../core/operations/completion";
import { currentDueDate, editDueDate, isTaskLine } from "../editor/due-date-edit";
import { TaskPlannerSettings } from "../settings/types";

export class DueDateModal extends Modal {
  constructor(
    app: App,
    private initialDate: string | undefined,
    private applyDate: (date: string | null) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Set task due date");
    this.contentEl.addClass("task-planner-due-date");
    const form = this.contentEl.createEl("form");
    const label = form.createEl("label", { text: "Due date" });
    const input = label.createEl("input", { type: "date", attr: { "aria-label": "Due date", required: "", min: "0001-01-01", max: "9999-12-31" } });
    input.value = this.initialDate ?? Completion.completeDate("today") ?? "";
    const buttons = form.createDiv({ cls: "modal-button-container" });
    if (this.initialDate) {
      buttons.createEl("button", { text: "Remove date", attr: { type: "button" } }).addEventListener("click", () => this.submit(null));
    }
    buttons.createEl("button", { text: "Cancel", attr: { type: "button" } }).addEventListener("click", () => this.close());
    buttons.createEl("button", { text: "Save", attr: { type: "submit" }, cls: "mod-cta" });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (form.reportValidity()) this.submit(input.value);
    });
    input.focus();
  }

  private submit(date: string | null): void {
    this.close();
    this.applyDate(date);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class DueDateEditor {
  private modal?: DueDateModal;

  constructor(
    private app: App,
    private getSettings: () => TaskPlannerSettings
  ) {}

  close(): void {
    this.modal?.close();
    this.modal = undefined;
  }

  open(editor: Editor, file: TFile, triggerStart?: number): void {
    const snapshot = editor.getValue();
    const cursor = editor.getCursor();
    if (!isTaskLine(snapshot, cursor.line)) return;
    const original = editor.getLine(cursor.line);
    const settings = structuredClone(this.getSettings());
    this.close();
    this.modal = new DueDateModal(this.app, currentDueDate(original, settings), (date) => {
      // A modal must never overwrite a sync edit or a different note opened in
      // the same leaf while the picker was displayed. Ask the user to retry.
      const active = this.app.workspace.activeEditor;
      if (active?.editor !== editor || active.file !== file || editor.getValue() !== snapshot || this.getSettings().dueDateAttribute !== settings.dueDateAttribute) {
        new Notice("The note changed while choosing a date. Reopen the date picker and try again.");
        return;
      }
      const updated = editDueDate(original, date, settings, triggerStart);
      if (updated !== original) {
        let start = 0;
        while (start < original.length && start < updated.length && original[start] === updated[start]) start++;
        let end = original.length;
        let updatedEnd = updated.length;
        while (end > start && updatedEnd > start && original[end - 1] === updated[updatedEnd - 1]) {
          end--;
          updatedEnd--;
        }
        const ch = cursor.ch < start ? cursor.ch : cursor.ch >= end ? cursor.ch + updatedEnd - end : updatedEnd;
        editor.transaction({
          changes: [{ from: { line: cursor.line, ch: start }, to: { line: cursor.line, ch: end }, text: updated.slice(start, updatedEnd) }],
          selection: { from: { line: cursor.line, ch } },
        });
      }
      editor.focus();
    });
    this.modal.open();
  }
}
