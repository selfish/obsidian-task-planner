// eslint-disable-next-line import/no-extraneous-dependencies -- @codemirror/view is provided by Obsidian at runtime
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { StatusOperations } from "../core/operations/status-operations";
import { TaskPlannerSettings } from "../settings/types";

/**
 * Creates a CodeMirror extension that auto-converts attribute shortcuts
 * (like @high, @today) to Dataview format when the cursor leaves a line.
 */
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

        // Only process when cursor moves to a different line
        if (currentLine !== this.lastLine && this.lastLine >= 0) {
          this.convertLine(this.lastLine);
        }

        this.lastLine = currentLine;
      }

      private getCurrentLine(): number {
        const state = this.view.state;
        const selection = state.selection.main;
        return state.doc.lineAt(selection.head).number - 1; // 0-indexed
      }

      private convertLine(lineIndex: number) {
        const state = this.view.state;
        const lineCount = state.doc.lines;

        if (lineIndex < 0 || lineIndex >= lineCount) {
          return;
        }

        const line = state.doc.line(lineIndex + 1); // 1-indexed in CodeMirror
        const lineText = line.text;

        // Only process lines that look like todos with @ attributes
        if (!lineText.includes("@") || !lineText.match(/^(\s*)?[-*]\s*\[.\]/)) {
          return;
        }

        // Refresh statusOperations with current settings
        const currentStatusOperations = new StatusOperations(getSettings());
        const converted = currentStatusOperations.convertAttributes(lineText);

        // Only update if the line actually changed
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
