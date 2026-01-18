import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

import { StatusOperations } from "../core";
import { TaskPlannerSettings } from "../settings";

// Auto-converts @shortcuts to Dataview format when cursor leaves a line
export function createAutoConvertExtension(getSettings: () => TaskPlannerSettings) {
  return ViewPlugin.fromClass(
    class {
      private lastLine: number = -1;

      constructor(private view: EditorView) {
        this.lastLine = this.getCurrentLine();
      }

      update(_update: ViewUpdate) {
        if (!getSettings().autoConvertAttributes) {
          return;
        }

        const currentLine = this.getCurrentLine();

        if (currentLine !== this.lastLine && this.lastLine >= 0) {
          const lineToConvert = this.lastLine;
          // Defer to avoid "update during update" error
          setTimeout(() => this.convertLine(lineToConvert), 0);
        }

        this.lastLine = currentLine;
      }

      private getCurrentLine(): number {
        const state = this.view.state;
        const selection = state.selection.main;
        return state.doc.lineAt(selection.head).number - 1;
      }

      private convertLine(lineIndex: number) {
        const state = this.view.state;
        const lineCount = state.doc.lines;

        if (lineIndex < 0 || lineIndex >= lineCount) {
          return;
        }

        const line = state.doc.line(lineIndex + 1);
        const lineText = line.text;

        if (!lineText.includes("@") || !lineText.match(/^(\s*)?[-*]\s*\[.\]/)) {
          return;
        }

        const currentStatusOperations = new StatusOperations(getSettings());
        const converted = currentStatusOperations.convertAttributes(lineText);

        if (converted !== lineText) {
          this.view.dispatch({
            changes: {
              from: line.from,
              to: line.to,
              insert: converted,
            },
          });
        }
      }
    }
  );
}
