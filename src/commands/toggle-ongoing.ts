import { Command, Editor, MarkdownFileInfo, MarkdownView } from "obsidian";

import { StatusOperations } from "../core";
import { TodoStatus } from "../types";

export class ToggleOngoingTodoCommand implements Command {
  id = "toggle-ongoing-todo";
  name = "Mark todo as ongoing / unchecked";
  icon = "clock";

  constructor(private lineOperations: StatusOperations) {}

  editorCallback(editor: Editor, _ctx: MarkdownView | MarkdownFileInfo): void {
    const lineNumber = editor.getCursor("from").line;
    let line = editor.getLine(lineNumber);
    const todo = this.lineOperations.toTodo(line, lineNumber);

    if (todo.isTodo && todo.todo) {
      const newCheckmark = todo.todo.status === TodoStatus.InProgress ? " " : ">";
      line = this.lineOperations.setCheckmark(line, newCheckmark);
      editor.setLine(lineNumber, line);
    }
  }
}
