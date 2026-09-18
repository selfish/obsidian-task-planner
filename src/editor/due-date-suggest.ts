import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestTriggerInfo, TFile } from "obsidian";

import { dateTriggerStart, isTaskLine } from "./due-date-edit";
import { Completion } from "../core/operations/completion";
import { TaskPlannerSettings } from "../settings/types";
import { DueDateEditor } from "../ui/due-date-modal";

function makeDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month, day);
  return date;
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = makeDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
}

function formatDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

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
    const calendar = form.createDiv({ cls: "task-planner-due-date-calendar" });
    let visibleMonth = parseDate(input.value) ?? new Date();
    const drawCalendar = (): void => {
      calendar.replaceChildren();
      const header = calendar.createDiv({ cls: "task-planner-due-date-calendar-header" });
      const previous = header.createEl("button", { text: "‹", attr: { type: "button", "aria-label": "Previous month" } });
      header.createSpan({ text: visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" }), cls: "task-planner-due-date-calendar-title" });
      const next = header.createEl("button", { text: "›", attr: { type: "button", "aria-label": "Next month" } });
      const changeMonth = (offset: number): void => {
        visibleMonth = makeDate(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
        drawCalendar();
        calendar.querySelector<HTMLButtonElement>(`[aria-label="${offset < 0 ? "Previous" : "Next"} month"]`)?.focus();
      };
      previous.addEventListener("click", () => changeMonth(-1));
      next.addEventListener("click", () => changeMonth(1));

      const grid = calendar.createDiv({ cls: "task-planner-due-date-calendar-grid", attr: { role: "grid", "aria-label": "Choose due date" } });
      for (const weekday of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) grid.createSpan({ text: weekday, cls: "task-planner-due-date-weekday", attr: { role: "columnheader", "aria-label": weekday } });
      const year = visibleMonth.getFullYear();
      const month = visibleMonth.getMonth();
      const firstWeekday = makeDate(year, month, 1).getDay();
      const days = makeDate(year, month + 1, 0).getDate();
      for (let index = 0; index < firstWeekday; index++) grid.createSpan({ cls: "task-planner-due-date-empty", attr: { "aria-hidden": "true" } });
      const today = Completion.completeDate("today");
      for (let day = 1; day <= days; day++) {
        const date = makeDate(year, month, day);
        const value = formatDate(date);
        const button = grid.createEl("button", {
          text: String(day),
          cls: `${value === input.value ? "is-selected " : ""}${value === today ? "is-today" : ""}`.trim(),
          attr: {
            type: "button",
            "data-date": value,
            "aria-label": date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
            "aria-pressed": String(value === input.value),
            ...(value === today ? { "aria-current": "date" } : {}),
          },
        });
        const select = (selected: Date): void => {
          input.value = formatDate(selected);
          visibleMonth = selected;
          drawCalendar();
          calendar.querySelector<HTMLButtonElement>(`[data-date="${input.value}"]`)?.focus();
        };
        button.addEventListener("click", () => select(date));
        button.addEventListener("keydown", (event) => {
          const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
          if (offset === undefined) return;
          event.preventDefault();
          select(makeDate(year, month, day + offset));
        });
      }
    };
    input.addEventListener("change", () => {
      const date = parseDate(input.value);
      if (date) {
        visibleMonth = date;
        drawCalendar();
      }
    });
    drawCalendar();
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
