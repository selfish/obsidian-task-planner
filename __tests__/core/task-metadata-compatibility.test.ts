import { FileOperations } from "../../src/core/operations/file-operations";
import { LineParser } from "../../src/core/parsers/line-parser";
import { DEFAULT_SETTINGS } from "../../src/settings";
import { FileAdapter, TaskItem, TaskStatus } from "../../src/types";

/**
 * Compatibility evidence for obsidian-tasks-group/obsidian-tasks at
 * c528ce5337d619bb0384d59a67d017661e3cfc70 (2026-07-22):
 *
 * - docs/Reference/Task Formats/Dataview Format.md
 * - docs/Reference/Task Formats/Tasks Emoji Format.md
 * - tests/TaskSerializer/DataviewTaskSerializer.test.ts
 *
 * These tests intentionally characterize current Task Planner behavior. They
 * do not define a migration policy or silently translate between task formats.
 */
describe("Tasks metadata compatibility matrix", () => {
  const parser = new LineParser();

  function parseAndRoundTrip(source: string) {
    const line = parser.parseLine(source);
    const parsed = parser.parseAttributes(line.line);
    line.line = parser.attributesToString(parsed);
    return {
      attributes: parsed.attributes,
      output: parser.lineToString(line),
    };
  }

  it("reads and round-trips canonical Tasks Dataview fields in square brackets", () => {
    const source = "- [ ] Task [id:: abc123] [dependsOn:: def456,ghi789] [priority:: highest] [repeat:: every day] [onCompletion:: delete] [created:: 2026-07-20] [start:: 2026-07-21] [scheduled:: 2026-07-22] [due:: 2026-07-23] [cancelled:: 2026-07-24] [completion:: 2026-07-25]";

    expect(parseAndRoundTrip(source)).toEqual({
      attributes: {
        id: "abc123",
        dependsOn: "def456,ghi789",
        priority: "highest",
        repeat: "every day",
        onCompletion: "delete",
        created: "2026-07-20",
        start: "2026-07-21",
        scheduled: "2026-07-22",
        due: "2026-07-23",
        cancelled: "2026-07-24",
        completion: "2026-07-25",
      },
      output: source,
    });
  });

  it.each([
    ["lowest", "- [ ] Task [priority:: lowest]"],
    ["low", "- [ ] Task [priority:: low]"],
    ["medium", "- [ ] Task [priority:: medium]"],
    ["high", "- [ ] Task [priority:: high]"],
    ["highest", "- [ ] Task [priority:: highest]"],
  ])("reads and round-trips canonical %s priority", (priority, source) => {
    expect(parseAndRoundTrip(source)).toEqual({
      attributes: { priority },
      output: source,
    });
  });

  it("represents canonical normal priority as no priority field", () => {
    const source = "- [ ] Task";

    expect(parseAndRoundTrip(source)).toEqual({
      attributes: {},
      output: source,
    });
  });

  it("records current Task Planner metadata defaults", () => {
    expect({
      dueDateAttribute: DEFAULT_SETTINGS.dueDateAttribute,
      completedDateAttribute: DEFAULT_SETTINGS.completedDateAttribute,
      selectedAttribute: DEFAULT_SETTINGS.selectedAttribute,
    }).toEqual({
      dueDateAttribute: "due",
      completedDateAttribute: "completed",
      selectedAttribute: "selected",
    });
  });

  it.each([
    ["critical priority", "- [ ] Task [priority:: critical]", { priority: "critical" }],
    ["importance alias", "- [ ] Task [importance:: high]", { importance: "high" }],
    ["completed date", "- [x] Task [completed:: 2026-07-25]", { completed: "2026-07-25" }],
  ])("reads and round-trips current Task Planner %s metadata", (_scenario, source, attributes) => {
    expect(parseAndRoundTrip(source)).toEqual({ attributes, output: source });
  });

  it.each([
    {
      syntax: "parenthesized Dataview fields",
      source: "- [ ] Task (due:: 2026-07-23) (priority:: high)",
    },
    {
      syntax: "Tasks emoji fields",
      source: "- [ ] Task 🆔 abc123 ⛔ def456 🔺 🔁 every day 🏁 delete ➕ 2026-07-20 🛫 2026-07-21 ⏳ 2026-07-22 📅 2026-07-23 ❌ 2026-07-24 ✅ 2026-07-25",
    },
    {
      syntax: "malformed Dataview fields",
      source: "- [ ] Task [due::] [priority:: high)",
    },
  ])("currently leaves $syntax unparsed and round-trips this canonical-spacing example unchanged", ({ source }) => {
    expect(parseAndRoundTrip(source)).toEqual({
      attributes: {},
      output: source,
    });
  });

  it("round-trips an unknown trailing Dataview field", () => {
    const source = "- [ ] Task [owner:: Alice]";

    expect(parseAndRoundTrip(source)).toEqual({
      attributes: { owner: "Alice" },
      output: source,
    });
  });

  it.each([
    {
      scenario: "fields positioned within task text move to the end",
      source: "- [ ] Task [due:: 2026-07-23] words [priority:: high]",
      attributes: { due: "2026-07-23", priority: "high" },
      output: "- [ ] Task words [due:: 2026-07-23] [priority:: high]",
    },
    {
      scenario: "repeated fields collapse to their final value",
      source: "- [ ] Task [due:: 2026-07-23] [due:: 2026-07-24]",
      attributes: { due: "2026-07-24" },
      output: "- [ ] Task [due:: 2026-07-24]",
    },
    {
      scenario: "task-text whitespace is normalized",
      source: "- [ ] Task   with   spacing [owner:: Alice]",
      attributes: { owner: "Alice" },
      output: "- [ ] Task with spacing [owner:: Alice]",
    },
  ])("documents current lossy rewrite: $scenario", ({ source, attributes, output }) => {
    expect(parseAndRoundTrip(source)).toEqual({ attributes, output });
  });

  it("preserves unknown and emoji text but adds parallel Dataview metadata when editing", async () => {
    let content = "- [ ] Task 📅 2026-07-23 ⏫ [owner:: Alice]";
    const file: FileAdapter<unknown> = {
      file: {},
      id: "compatibility-matrix",
      name: "compatibility-matrix.md",
      path: "compatibility-matrix.md",
      getContent: async () => content,
      setContent: async (value) => {
        content = value;
      },
      isInFolder: () => false,
    };
    const task: TaskItem<unknown> = {
      status: TaskStatus.Todo,
      text: "Task 📅 2026-07-23 ⏫",
      file,
      line: 0,
      tags: [],
    };

    await new FileOperations().updateAttribute(task, "due", "2026-07-24");

    expect(content).toBe("- [ ] Task 📅 2026-07-23 ⏫ [owner:: Alice] [due:: 2026-07-24]");
  });
});
