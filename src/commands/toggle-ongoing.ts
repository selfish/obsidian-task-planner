import { StatusOperations } from "../core/operations/status-operations";
import { TodoStatus } from "../types/todo";
import { Command, Editor, MarkdownFileInfo, MarkdownView } from "obsidian";

export class ToggleOngoingTodoCommand implements Command {
  id = "task-planner.toggle-ongoing-todo";
  name = "Mark todo as ongoing / unchecked";
  icon = "clock";

  constructor(private lineOperations: StatusOperations) {}

  editorCallback(editor: Editor, ctx: MarkdownView | MarkdownFileInfo): void {
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
