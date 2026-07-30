import { FileOperations } from "../../src/core/operations/file-operations";
import { FileTaskParser } from "../../src/core/parsers/file-task-parser";
import { DEFAULT_SETTINGS } from "../../src/settings/types";
import { FileAdapter, TaskItem, TaskStatus } from "../../src/types";

type AtomicFile = FileAdapter<unknown> & { content: () => string };

function atomicFile(content: string): AtomicFile {
  let current = content;
  return {
    id: "tasks.md",
    path: "tasks.md",
    name: "tasks.md",
    file: {},
    content: () => current,
    getContent: jest.fn(async () => current),
    setContent: jest.fn(async () => {
      throw new Error("non-atomic write");
    }),
    processContent: jest.fn(async (update: (value: string) => string) => {
      current = update(current);
    }),
    isInFolder: () => false,
  };
}

function task(file: AtomicFile, sourceLine: string, line: number, status = TaskStatus.Todo): TaskItem<unknown> {
  return {
    file,
    line,
    sourceLine,
    sourceLineCount: 1,
    status,
    text: sourceLine
      .replace(/^.*?\[.\]\s*/, "")
      .replace(/\s+\[[^\]]+::[^\]]+\]/g, "")
      .replace(/\s+#\S+/g, ""),
  };
}

describe("atomic stale task writes", () => {
  it("relocates a stale task for attribute, tag, and status updates without changing unrelated bytes", async () => {
    const source = "-   [ ]\tTarget [unknown::  keep ] (owner:: #metadata) 🔁 #old";
    const file = atomicFile(`Inserted\r\n${source}\r\nUntouched  `);
    const todo = task(file, source, 0, TaskStatus.Complete);
    todo.tags = ["old"];
    const operations = new FileOperations();

    await operations.updateAttribute(todo, "due", "2026-08-01");
    await operations.removeTag(todo, "old");
    await operations.appendTag(todo, "new");
    todo.status = TaskStatus.Complete;
    await operations.updateTaskStatus(todo, "completed");

    expect(file.content()).toMatch(/^Inserted\r\n-   \[x\]\tTarget #new \[unknown::  keep \] \(owner:: #metadata\) 🔁 \[due:: 2026-08-01\] \[completed:: \d{4}-\d{2}-\d{2}\]\r\nUntouched  $/);
    expect(todo.line).toBe(1);
    expect(todo.sourceLine).toContain("[x]");
    expect(file.setContent).not.toHaveBeenCalled();
  });

  it("atomically relocates every task in same-file batch attribute, tag, and status paths", async () => {
    const one = "- [ ] One";
    const two = "- [ ] Two";
    const file = atomicFile(`Header\n${two}\nInserted\n${one}`);
    const tasks = [task(file, one, 0, TaskStatus.Complete), task(file, two, 1, TaskStatus.Complete)];
    const operations = new FileOperations();

    await operations.batchUpdateAttribute(tasks, "priority", "high");
    await operations.batchAppendTag(tasks, "planned");
    await operations.batchRemoveTag(tasks, "planned");
    tasks.forEach((item) => (item.status = TaskStatus.Complete));
    await operations.batchUpdateTaskStatus(tasks, "completed");

    expect(file.content()).toMatch(/^Header\n- \[x\] Two \[priority:: high\] \[completed:: \d{4}-\d{2}-\d{2}\]\nInserted\n- \[x\] One \[priority:: high\] \[completed:: \d{4}-\d{2}-\d{2}\]$/);
    expect(file.processContent).toHaveBeenCalledTimes(4);
    expect(file.setContent).not.toHaveBeenCalled();
  });

  it("fails closed without writing when the current source line is duplicated", async () => {
    const source = "- [ ] Duplicate";
    const file = atomicFile(`${source}\n${source}`);
    const todo = task(file, source, 0);
    const operations = new FileOperations();

    await expect(operations.updateAttribute(todo, "due", "2026-08-01")).rejects.toThrow("ambiguous");
    expect(file.content()).toBe(`${source}\n${source}`);
  });

  it("keeps an originally duplicated task ambiguous after one copy is deleted", async () => {
    const source = "- [ ] Duplicate";
    const file = atomicFile(source);
    const todo = { ...task(file, source, 1), sourceLineCount: 2 };

    await expect(new FileOperations().updateAttribute(todo, "due", "2026-08-01")).rejects.toThrow("ambiguous");
    expect(file.content()).toBe(source);
  });

  it("aborts a same-file batch when any target is missing", async () => {
    const file = atomicFile("- [ ] Present");
    const present = task(file, "- [ ] Present", 0);
    const missing = task(file, "- [ ] Missing", 1);

    await expect(new FileOperations().batchUpdateAttribute([present, missing], "due", "2026-08-01")).rejects.toThrow("not found");
    expect(file.content()).toBe("- [ ] Present");
  });

  it("allows a legacy task without sourceLine only while its exact indexed line still matches", async () => {
    const source = "- [ ] Target";
    const file = atomicFile(source);
    const todo = task(file, source, 0);
    delete todo.sourceLine;
    delete todo.sourceLineCount;

    await new FileOperations().updateAttribute(todo, "due", "new");

    expect(file.content()).toBe("- [ ] Target [due:: new]");
  });

  it("does not relocate a stale legacy task without sourceLine to another same-text task", async () => {
    const source = "- [ ] Target";
    const file = atomicFile(source);
    const todo = task(file, source, 1);
    delete todo.sourceLine;
    delete todo.sourceLineCount;

    await expect(new FileOperations().updateAttribute(todo, "due", "new")).rejects.toThrow("no safe source identity");
    expect(file.content()).toBe(source);
  });

  it("fails closed when a legacy task's exact line no longer has the same text", async () => {
    const file = atomicFile("- [ ] Replacement");
    const todo = task(file, "- [ ] Target", 0);
    delete todo.sourceLine;
    delete todo.sourceLineCount;

    await expect(new FileOperations().updateAttribute(todo, "due", "new")).rejects.toThrow("no safe source identity");
    expect(file.content()).toBe("- [ ] Replacement");
  });

  it("accepts a unique source identity when an older caller omitted its duplicate count", async () => {
    const source = "- [ ] Target";
    const file = atomicFile(source);
    const todo = task(file, source, 0);
    delete todo.sourceLineCount;

    await new FileOperations().updateAttribute(todo, "due", "new");

    expect(file.content()).toBe("- [ ] Target [due:: new]");
  });

  it("leaves an unindexed task unchanged", async () => {
    const source = "- [ ] Target";
    const file = atomicFile(source);
    const todo = task(file, source, 0);
    delete todo.line;

    await new FileOperations().updateAttribute(todo, "due", "new");

    expect(file.content()).toBe(source);
    expect(file.processContent).not.toHaveBeenCalled();
  });

  it("does not resolve a missing task to the same source line inside a code fence", async () => {
    const source = "- [ ] Example";
    const file = atomicFile(`\`\`\`markdown\n${source}\n\`\`\``);

    await expect(new FileOperations().updateAttribute(task(file, source, 0), "due", "2026-08-01")).rejects.toThrow("not found");
    expect(file.content()).toBe(`\`\`\`markdown\n${source}\n\`\`\``);
  });

  it("indexes exact source lines and duplicate counts with CRLF content", async () => {
    const source = "- [ ] Same";
    const file = atomicFile(`${source}\r\n${source}`);
    const tasks = await new FileTaskParser<unknown>(DEFAULT_SETTINGS).parseMdFile(file);

    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ sourceLine: source, sourceLineCount: 2 });
    expect(tasks[1]).toMatchObject({ sourceLine: source, sourceLineCount: 2 });
    expect(tasks[0].text).toBe("Same");
  });

  it("updates only real metadata and preserves matching text in code spans and wiki links", async () => {
    const source = "- [ ] Target `[due:: code]` [[Page|[due:: wiki]]] [due:: old]";
    const file = atomicFile(source);
    const [task] = await new FileTaskParser<unknown>(DEFAULT_SETTINGS).parseMdFile(file);

    await new FileOperations(DEFAULT_SETTINGS).updateAttribute(task, "due", "new");

    expect(file.content()).toBe("- [ ] Target `[due:: code]` [[Page|[due:: wiki]]] [due:: new]");
  });

  it("fails closed when two requested updates resolve to one task", async () => {
    const source = "- [ ] Same";
    const file = atomicFile(source);
    const first = task(file, source, 0);
    const second = task(file, source, 0);

    await expect(new FileOperations().batchUpdateAttribute([first, second], "due", "new")).rejects.toThrow("same task");
    expect(file.content()).toBe(source);
  });

  it("fails closed when the adapter cannot provide atomic writes", async () => {
    const source = "- [ ] Target";
    const file = atomicFile(source);
    file.processContent = undefined;

    await expect(new FileOperations().updateAttribute(task(file, source, 0), "due", "new")).rejects.toThrow("unavailable");
    expect(file.content()).toBe(source);
  });

  it("does not report failure after committing when the caller task is immutable", async () => {
    const source = "- [ ] Target";
    const file = atomicFile(source);
    const todo = Object.freeze(task(file, source, 0)) as TaskItem<unknown>;

    await expect(new FileOperations().updateAttribute(todo, "due", "new")).resolves.toBeUndefined();
    expect(file.content()).toBe("- [ ] Target [due:: new]");
  });

  it("appends tags outside code spans and wiki links in direct and batch updates", async () => {
    const file = atomicFile("- [ ] One `[due:: code]` [[Page|[due:: wiki]]] [due:: real]\n- [ ] Two `[owner:: code]` [owner:: real]");
    const tasks = await new FileTaskParser<unknown>(DEFAULT_SETTINGS).parseMdFile(file);
    const operations = new FileOperations(DEFAULT_SETTINGS);

    await operations.appendTag(tasks[0], "new");
    await operations.batchAppendTag([tasks[1]], "new");

    expect(file.content()).toBe("- [ ] One `[due:: code]` [[Page|[due:: wiki]]] #new [due:: real]\n- [ ] Two `[owner:: code]` #new [owner:: real]");
  });

  it("honors enabled and disabled shortcut settings during metadata updates", async () => {
    const disabledSettings = {
      ...DEFAULT_SETTINGS,
      atShortcutSettings: { ...DEFAULT_SETTINGS.atShortcutSettings, enableAtShortcuts: false },
    };
    const disabledFile = atomicFile("- [ ] Literal @high");
    const [disabledTask] = await new FileTaskParser<unknown>(disabledSettings).parseMdFile(disabledFile);
    await new FileOperations(disabledSettings).updateAttribute(disabledTask, "priority", "low");
    expect(disabledFile.content()).toBe("- [ ] Literal @high [priority:: low]");

    const enabledFile = atomicFile("- [ ] Selected @selected @high");
    const [enabledTask] = await new FileTaskParser<unknown>(DEFAULT_SETTINGS).parseMdFile(enabledFile);
    const operations = new FileOperations(DEFAULT_SETTINGS);
    await operations.removeAttribute(enabledTask, "selected");
    await operations.updateAttribute(enabledTask, "priority", "low");
    expect(enabledFile.content()).toBe("- [ ] Selected [priority:: low]");
  });

  it("removes punctuation-adjacent tags that the parser exposes", async () => {
    const file = atomicFile("- [ ] Target (#work), #other");
    const [todo] = await new FileTaskParser<unknown>(DEFAULT_SETTINGS).parseMdFile(file);
    expect(todo.tags).toEqual(["work", "other"]);

    await new FileOperations(DEFAULT_SETTINGS).removeTag(todo, "work");

    expect(file.content()).toBe("- [ ] Target (), #other");
  });

  it.each([
    ["tilde", "~~~markdown\n- [ ] Example\n~~~"],
    ["long backtick", "````markdown\n```\n- [ ] Example\n````"],
  ])("does not relocate a stale task into a %s fence", async (_name, content) => {
    const file = atomicFile(content);
    await expect(new FileOperations().updateAttribute(task(file, "- [ ] Example", 0), "due", "new")).rejects.toThrow("not found");
    expect(file.content()).toBe(content);
  });

  it("does not relocate a stale nested task into an indented fence", async () => {
    const source = "    - [ ] Example";
    const content = `    \`\`\`markdown\n${source}\n    \`\`\``;
    const file = atomicFile(content);
    await expect(new FileOperations().updateAttribute(task(file, source, 0), "due", "new")).rejects.toThrow("not found");
    expect(file.content()).toBe(content);
  });

  it("applies every same-file drag mutation in one atomic write", async () => {
    const source = "- [ ] Target #old [owner:: Alice]";
    const file = atomicFile(source);
    const [todo] = await new FileTaskParser<unknown>(DEFAULT_SETTINGS).parseMdFile(file);

    await new FileOperations(DEFAULT_SETTINGS).batchMove([todo], {
      attributeName: "due",
      attributeValue: "2026-08-09",
      completedAttribute: "completed",
      tag: "new",
      tagsToRemove: ["old"],
      newStatus: TaskStatus.Complete,
    });

    expect(file.content()).toMatch(/^- \[x\] Target #new \[owner:: Alice\] \[due:: 2026-08-09\] \[completed:: \d{4}-\d{2}-\d{2}\]$/);
    expect(file.processContent).toHaveBeenCalledTimes(1);
    expect(todo.status).toBe(TaskStatus.Complete);
  });

  it("covers optional combined-move paths without adding duplicate or missing tags", async () => {
    const source = "- [ ] Target #keep";
    const file = atomicFile(source);
    const [todo] = await new FileTaskParser<unknown>(DEFAULT_SETTINGS).parseMdFile(file);
    const operations = new FileOperations(DEFAULT_SETTINGS);

    await operations.batchMove([todo], {
      attributeName: "due",
      attributeValue: "2026-08-09",
      completedAttribute: "completed",
      tag: "keep",
      tagsToRemove: ["missing"],
      newStatus: TaskStatus.Todo,
    });
    await operations.batchMove([todo], {
      attributeName: "due",
      attributeValue: "2026-08-10",
      completedAttribute: "completed",
    });
    await operations.batchMove([todo], {
      attributeName: "due",
      attributeValue: "2026-08-11",
      completedAttribute: "completed",
      newStatus: TaskStatus.Canceled,
    });

    expect(file.content()).toMatch(/^- \[-\] Target #keep \[due:: 2026-08-11\] \[completed:: \d{4}-\d{2}-\d{2}\]$/);
    expect(file.processContent).toHaveBeenCalledTimes(3);
  });

  it("keeps unrelated fenced lines out of refreshed source counts", async () => {
    const source = "- [ ] Target";
    const file = atomicFile(`${source}\n\`\`\`markdown\n- [ ] Example\n\`\`\``);
    const todo = task(file, source, 0);

    await new FileOperations().updateAttribute(todo, "due", "new");

    expect(file.content()).toBe("- [ ] Target [due:: new]\n```markdown\n- [ ] Example\n```");
  });

  it.each([
    ["- [D] Delegated", TaskStatus.Delegated],
    ["- [C] Canceled", TaskStatus.Canceled],
    ["- [c] Canceled", TaskStatus.Canceled],
  ])("keeps the canonical status for %s after a non-status write", async (source, status) => {
    const file = atomicFile(source);
    const [todo] = await new FileTaskParser<unknown>(DEFAULT_SETTINGS).parseMdFile(file);
    await new FileOperations(DEFAULT_SETTINGS).updateAttribute(todo, "due", "new");
    expect(todo.status).toBe(status);
  });
});
