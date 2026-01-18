import { StatusOperations } from "../core";
import { TodoStatus } from "../types";
import { Command, Editor, MarkdownFileInfo, MarkdownView } from "obsidian";

export class ToggleTodoCommand implements Command {
  id = "toggle-todo";
  name = "Mark todo as checked / unchecked";
  icon = "check-small";

  constructor(private lineOperations: StatusOperations) {}

  editorCallback(editor: Editor, _ctx: MarkdownView | MarkdownFileInfo): void {
    const lineNumber = editor.getCursor("from").line;
    let line = editor.getLine(lineNumber);
    const todo = this.lineOperations.toTodo(line, lineNumber);

    if (todo.isTodo && todo.todo) {
      const newCheckmark = todo.todo.status === TodoStatus.Complete ? " " : "x";
      line = this.lineOperations.setCheckmark(line, newCheckmark);
      editor.setLine(lineNumber, line);
    }
  }
}
