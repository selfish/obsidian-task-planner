import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestTriggerInfo, TFile } from "obsidian";

import { dateTriggerStart, isTaskLine } from "./due-date-edit";
import { Completion } from "../core/operations/completion";
import { TaskPlannerSettings } from "../settings/types";
import { DueDateEditor } from "../ui/due-date-modal";

export class DueDateSuggest extends EditorSuggest<string> {
  private input?: HTMLInputElement;

  constructor(
    app: App,
    private getSettings: () => TaskPlannerSettings,
    private picker: DueDateEditor
  ) {
    super(app);
    this.setInstructions([{ command: "esc", purpose: "dismiss" }]);
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    if (!file || editor.somethingSelected()) return null;
    const start = dateTriggerStart(editor.getLine(cursor.line), cursor.ch, this.getSettings());
    if (start === null || !isTaskLine(editor.getValue(), cursor.line)) return null;
    return { start: { line: cursor.line, ch: start }, end: cursor, query: "date" };
  }

  getSuggestions(): string[] {
    return ["date"];
  }

  renderSuggestion(_value: string, element: HTMLElement): void {
    const context = this.context;
    if (!context) return;
    const session = this.picker.start(context.editor, context.file, context.start.ch);
    if (!session) return;

    element.addClass("task-planner-due-date-suggest");
    const form = element.createEl("form");
    const label = form.createEl("label", { text: "Due date" });
    const input = label.createEl("input", { type: "date", attr: { "aria-label": "Due date", required: "", min: "0001-01-01", max: "9999-12-31" } });
    input.value = session.initialDate ?? Completion.completeDate("today") ?? "";
    this.input = input;
    const buttons = form.createDiv({ cls: "task-planner-due-date-actions" });
    if (session.initialDate) buttons.createEl("button", { text: "Remove date", attr: { type: "button" } }).addEventListener("click", () => this.submit(session.apply, null));
    buttons.createEl("button", { text: "Cancel", attr: { type: "button" } }).addEventListener("click", () => this.close());
    buttons.createEl("button", { text: "Save", attr: { type: "submit" }, cls: "mod-cta" });
    form.addEventListener("click", (event) => event.stopPropagation());
    form.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") event.stopPropagation();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (form.reportValidity()) this.submit(session.apply, input.value);
    });
  }

  selectSuggestion(): void {
    this.input?.focus();
  }

  private submit(apply: (date: string | null) => void, date: string | null): void {
    this.close();
    apply(date);
  }
}
