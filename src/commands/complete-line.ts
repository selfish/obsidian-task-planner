import { StatusOperations } from "../core/operations/status-operations";
import { Command, Editor, MarkdownFileInfo, MarkdownView } from "obsidian";

export class CompleteLineCommand implements Command {
  id = "task-planner.complete-line";
  name = "Complete line attributes";
  icon = "check-small";

  constructor(private lineOperations: StatusOperations) {}

  editorCallback(editor: Editor, _ctx: MarkdownView | MarkdownFileInfo): void {
    const lineNumber = editor.getCursor("from").line;
    let line = editor.getLine(lineNumber);
    line = this.lineOperations.convertAttributes(line);
    editor.setLine(lineNumber, line);
  }
}
