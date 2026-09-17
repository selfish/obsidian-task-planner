import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestTriggerInfo, TFile } from "obsidian";

import { dateTriggerStart, isTaskLine } from "./due-date-edit";
import { TaskPlannerSettings } from "../settings/types";
import { DueDateEditor } from "../ui/due-date-modal";

export class DueDateSuggest extends EditorSuggest<string> {
  constructor(
    app: App,
    private getSettings: () => TaskPlannerSettings,
    private picker: DueDateEditor
  ) {
    super(app);
    this.setInstructions([
      { command: "↵", purpose: "choose date" },
      { command: "esc", purpose: "dismiss" },
    ]);
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    if (!file || editor.somethingSelected()) return null;
    const start = dateTriggerStart(editor.getLine(cursor.line), cursor.ch, this.getSettings());
    if (start === null || !isTaskLine(editor.getValue(), cursor.line)) return null;
    return { start: { line: cursor.line, ch: start }, end: cursor, query: "date" };
  }

  getSuggestions(): string[] {
    return ["Choose due date…"];
  }

  renderSuggestion(value: string, element: HTMLElement): void {
    element.setText(value);
  }

  selectSuggestion(): void {
    const context = this.context;
    this.close();
    if (context) this.picker.open(context.editor, context.file, context.start.ch);
  }
}
