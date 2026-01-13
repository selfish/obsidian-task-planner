import { LineOperations } from "../domain/LineOperations";
import { Command, Editor, MarkdownFileInfo, MarkdownView } from "obsidian";

export class CompleteLineCommand implements Command {
  id = "task-planner.complete-line";
  name = "Complete line attributes";
  icon = "check-small";

  constructor(private lineOperations: LineOperations) {}

  editorCallback(editor: Editor, ctx: MarkdownView | MarkdownFileInfo): void {
    const lineNumber = editor.getCursor("from").line;
    let line = editor.getLine(lineNumber);
    line = this.lineOperations.convertAttributes(line);
    editor.setLine(lineNumber, line);
  }
}
