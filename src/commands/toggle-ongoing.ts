import { Command, Editor, MarkdownFileInfo, MarkdownView } from "obsidian";

import { StatusOperations } from "../core";
import { TaskStatus } from "../types";

export class ToggleOngoingTaskCommand implements Command {
  id = "toggle-ongoing-task";
  name = "Mark task as ongoing / unchecked";
  icon = "clock";

  constructor(private lineOperations: StatusOperations) {}

  editorCallback(editor: Editor, _ctx: MarkdownView | MarkdownFileInfo): void {
    const lineNumber = editor.getCursor("from").line;
    let line = editor.getLine(lineNumber);
    const task = this.lineOperations.toTask(line, lineNumber);

    if (task.isTask && task.task) {
      const newCheckmark = task.task.status === TaskStatus.InProgress ? " " : ">";
      line = this.lineOperations.setCheckmark(line, newCheckmark);
      editor.setLine(lineNumber, line);
    }
  }
}
