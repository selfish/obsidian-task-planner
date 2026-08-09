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

  function editableTask(source: string) {
    let content = source;
    const file: FileAdapter<unknown> = {
      file: {},
      id: "compatibility-matrix",
      name: "compatibility-matrix.md",
      path: "compatibility-matrix.md",
      getContent: async () => content,
      setContent: async (value) => {
        content = value;
      },
      processContent: async (update) => {
        content = update(content);
      },
      isInFolder: () => false,
    };
    const task: TaskItem<unknown> = {
      status: TaskStatus.Todo,
      text: parser.parseAttributes(parser.parseLine(source).line).textWithoutAttributes,
      file,
      line: 0,
      sourceLine: source,
      sourceLineCount: 1,
      tags: [],
    };
    return { task, content: () => content };
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

  it("reads parenthesized Dataview fields and keeps square brackets as canonical whole-line output", () => {
    expect(parseAndRoundTrip("- [ ] Task (due:: 2026-07-23) (priority:: high)")).toEqual({
      attributes: { due: "2026-07-23", priority: "high" },
      output: "- [ ] Task [due:: 2026-07-23] [priority:: high]",
    });
  });

  it("ignores parenthesized field-like text in code spans and wikilinks", () => {
    expect(parseAndRoundTrip("- [ ] Task `(due:: code)` [[Page|(due:: link)]] (due:: 2026-07-23)")).toEqual({
      attributes: { due: "2026-07-23" },
      output: "- [ ] Task `(due:: code)` [[Page|(due:: link)]] [due:: 2026-07-23]",
    });
  });

  it.each([
    "Read <https://example.test/[due::secret]>",
    'Read <https://example.test/"[due::secret]>',
    'Read <span data-note="[due:: secret]">now</span>',
    "Read <!-- compare > [due:: secret] -->",
    "Read <?instruction > [due:: secret]?>",
    "Read <![CDATA[> [due:: secret]]]>",
  ])("preserves field-like text inside angle contexts: %s", (text) => {
    expect(parseAndRoundTrip(`- [ ] ${text} [due:: 2026-07-23]`)).toEqual({
      attributes: { due: "2026-07-23" },
      output: `- [ ] ${text} [due:: 2026-07-23]`,
    });
    expect(parser.updateAttribute(text, "due", "2026-07-23")).toBe(`${text} [due:: 2026-07-23]`);
    expect(parser.updateAttribute(text, "due", undefined)).toBe(text);
    expect(parser.appendTag(text, "next")).toBe(`${text} #next`);
  });

  it.each(["- [ ] Task `(due:: same)` (due:: same)", "- [ ] Task [[Page|(due:: same)]] (due:: same)"])("preserves identical protected field text when parsing real metadata: %s", (source) => {
    expect(parseAndRoundTrip(source)).toEqual({
      attributes: { due: "same" },
      output: source.replace(/ \(due:: same\)$/, " [due:: same]"),
    });
  });

  it.each(["- [ ] Task (note:: (due:: 2026-07-23)", "- [ ] Task (note:: ping @high (nested))", "- [ ] Task (wrapper `)` (due:: 2026-07-23) #kept", "- [ ] Task (wrapper [[Page|)]] (due:: 2026-07-23) #kept"])("leaves nested or malformed parenthesized containers unparsed: %s", (source) => {
    expect(parseAndRoundTrip(source)).toEqual({ attributes: {}, output: source });
  });

  it.each(["- [ ] Task (note:: [[Page]])", "- [ ] Task (note:: [due:: 2026-07-23])", "- [ ] Task [note:: [[Page]]]"])("leaves fields with nested square-bracket values unparsed: %s", (source) => {
    expect(parseAndRoundTrip(source)).toEqual({ attributes: {}, output: source });
  });

  it.each(["- [ ] Task `(note:: code` (due:: 2026-07-23)", "- [ ] Task [[Page|(note:: link]] (due:: 2026-07-23)"])("does not let malformed protected text suppress later metadata: %s", (source) => {
    expect(parseAndRoundTrip(source)).toEqual({
      attributes: { due: "2026-07-23" },
      output: source.replace(/ \(due:: 2026-07-23\)$/, " [due:: 2026-07-23]"),
    });
  });

  it("ignores protected delimiters while finding later metadata boundaries", () => {
    const source = "- [ ] Task (note:: `(`) (due:: 2026-07-23)";

    expect(parseAndRoundTrip(source)).toEqual({
      attributes: { due: "2026-07-23" },
      output: "- [ ] Task (note:: `(`) [due:: 2026-07-23]",
    });
    expect(parser.appendTag(source, "next")).toBe("- [ ] Task #next (note:: `(`) (due:: 2026-07-23)");
  });

  it.each(["- [ ] Task ((due:: 2026-07-23))", "- [ ] Task (wrapper (due:: 2026-07-23))"])("leaves fields nested in parenthesized wrappers unparsed: %s", (source) => {
    expect(parseAndRoundTrip(source)).toEqual({ attributes: {}, output: source });
  });

  it.each(["- [ ] Task `(note:: code` (due:: 2026-07-23)", "- [ ] Task [[Page|(note:: link]] (due:: 2026-07-23)"])("updates real metadata after malformed protected field-like text: %s", async (source) => {
    const state = editableTask(source);
    await new FileOperations().updateAttribute(state.task, "due", "2026-07-24");
    expect(state.content()).toBe(source.replace("(due:: 2026-07-23)", "(due:: 2026-07-24)"));
  });

  it.each(["- [ ] Task ((due:: 2026-07-23))", "- [ ] Task (wrapper (due:: 2026-07-23))"])("does not remove fields nested in parenthesized wrappers: %s", async (source) => {
    const state = editableTask(source);
    await new FileOperations().removeAttribute(state.task, "due");
    expect(state.content()).toBe(source);
  });

  it.each([
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

  it("edits and removes parenthesized fields in place without rewriting neighboring metadata", async () => {
    const source = "- [ ] Task `(due:: code)` [[Page|(due:: link)]] (due:: 2026-07-23) (owner:: Alice) [note:: keep]";
    const state = editableTask(source);
    const operations = new FileOperations();

    await operations.updateAttribute(state.task, "due", "2026-07-24");
    expect(state.content()).toBe("- [ ] Task `(due:: code)` [[Page|(due:: link)]] (due:: 2026-07-24) (owner:: Alice) [note:: keep]");

    await operations.appendTag(state.task, "planned");
    expect(state.content()).toBe("- [ ] Task `(due:: code)` [[Page|(due:: link)]] #planned (due:: 2026-07-24) (owner:: Alice) [note:: keep]");

    await operations.removeAttribute(state.task, "due");
    expect(state.content()).toBe("- [ ] Task `(due:: code)` [[Page|(due:: link)]] #planned (owner:: Alice) [note:: keep]");
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
    const state = editableTask("- [ ] Task 📅 2026-07-23 ⏫ [owner:: Alice]");

    await new FileOperations().updateAttribute(state.task, "due", "2026-07-24");

    expect(state.content()).toBe("- [ ] Task 📅 2026-07-23 ⏫ [owner:: Alice] [due:: 2026-07-24]");
  });
});
