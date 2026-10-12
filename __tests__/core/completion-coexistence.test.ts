import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UndoManager } from "../../src/core/operations/undo-manager";
import { UndoableFileOperations } from "../../src/core/operations/undoable-file-ops";
import { StatusOperations } from "../../src/core/operations/status-operations";
import { DEFAULT_SETTINGS } from "../../src/settings";
import { FileAdapter, TaskItem, TaskStatus } from "../../src/types";

const fixtures: { id: string; line: string }[] = JSON.parse(readFileSync(resolve(__dirname, "../../test/e2e/completion-fixtures.json"), "utf8"));
const mixed = fixtures.filter(({ id }) => id.includes("first"));

// Real parser/writer/undo implementation, not the mocked FileOperations suite.
// Sibling query semantics for the same fixtures are checked in real Obsidian.
describe("mixed completion fields: configured edits and undo", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-12T12:00:00Z"));
  });
  afterEach(() => jest.useRealTimers());

  for (const key of ["completed", "completion"]) {
    it.each(mixed)(`preserves the other completion field for configured ${key}: $id`, async ({ line }) => {
      const settings = { ...DEFAULT_SETTINGS, completedDateAttribute: key };
      const parser = new StatusOperations(settings);
      const original = `Unrelated text\r\n${line}\r\n  continuation (owner:: keep)\r\n`;
      let content = original;
      const file: FileAdapter<unknown> = {
        file: {},
        id: "mixed.md",
        name: "mixed.md",
        path: "mixed.md",
        getContent: async () => content,
        setContent: async (value) => {
          content = value;
        },
        processContent: async (update) => {
          content = update(content);
        },
        isInFolder: () => false,
      };
      const currentTask = () => {
        const sourceLine = content.split("\r\n")[1];
        return { ...parser.toTask(sourceLine, 1).task, file, sourceLine, sourceLineCount: 1 } as TaskItem<unknown>;
      };
      const manager = new UndoManager();
      const operations = new UndoableFileOperations({ settings, undoManager: manager });
      const task = currentTask();
      expect(task.status).toBe(TaskStatus.Complete);
      expect(task.attributes).toEqual({ unknown: "keep", completed: "2026-10-08", completion: "2026-10-09" });
      task.status = TaskStatus.Canceled;
      await operations.updateTaskStatusWithUndo(task, TaskStatus.Complete, "Cancel fixture");
      const oldDate = key === "completed" ? "2026-10-08" : "2026-10-09";
      expect(content).toBe(original.replace("- [x]", "- [-]").replace(`${key}:: ${oldDate}`, `${key}:: 2026-10-12`));
      expect(settings.completedDateAttribute).toBe(key);
      expect(manager.getLastOperation()?.statusChanges[0].previousCompletedDate).toBe(oldDate);
      expect(await operations.applyUndo(manager.popForUndo()!, () => currentTask())).toBe(true);
      expect(content).toBe(original);
      expect(settings.completedDateAttribute).toBe(key);
    });
  }
});
