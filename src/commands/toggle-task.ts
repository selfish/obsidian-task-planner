import { Command, Editor, MarkdownFileInfo, MarkdownView } from "obsidian";

import { StatusOperations } from "../core";
import { TaskStatus } from "../types";

export class ToggleTaskCommand implements Command {
  id = "toggle-task";
  name = "Mark task as checked / unchecked";
  icon = "check-small";

  constructor(private lineOperations: StatusOperations) {}

  editorCallback(editor: Editor, _ctx: MarkdownView | MarkdownFileInfo): void {
    const lineNumber = editor.getCursor("from").line;
    let line = editor.getLine(lineNumber);
    const task = this.lineOperations.toTask(line, lineNumber);

    if (task.isTask && task.task) {
      const newCheckmark = task.task.status === TaskStatus.Complete ? " " : "x";
      line = this.lineOperations.setCheckmark(line, newCheckmark);
      editor.setLine(lineNumber, line);
    }
  }
}
