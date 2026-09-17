import { App, Command, Editor, MarkdownFileInfo, MarkdownView } from "obsidian";

import { StatusOperations } from "../core";
import { TaskPlannerSettings } from "../settings";
import { DueDateModal } from "../ui/due-date-modal";

type OpenDatePicker = (initialDate: string, onSubmit: (date: string) => void) => void;

export class SetDueDateCommand implements Command {
  id = "set-due-date";
  name = "Set due date on current task";
  icon = "calendar-days";

  constructor(
    app: App,
    private getSettings: () => TaskPlannerSettings,
    private openDatePicker: OpenDatePicker = (initialDate, onSubmit) => new DueDateModal(app, initialDate, onSubmit).open()
  ) {}

  editorCheckCallback(checking: boolean, editor: Editor, _ctx: MarkdownView | MarkdownFileInfo): boolean {
    const lineNumber = editor.getCursor("from").line;
    const line = editor.getLine(lineNumber);
    const operations = new StatusOperations(this.getSettings());
    const parsed = operations.toTask(line, lineNumber);
    if (!parsed.isTask) return false;
    if (checking) return true;

    const dueKey = this.getSettings().dueDateAttribute.toLowerCase();
    const initialDate = Object.entries(parsed.task?.attributes ?? {}).find(([key]) => key.toLowerCase() === dueKey)?.[1];
    this.openDatePicker(typeof initialDate === "string" ? initialDate : "", (date) => {
      editor.setLine(lineNumber, operations.setDueDate(editor.getLine(lineNumber), date));
    });
    return true;
  }
}
