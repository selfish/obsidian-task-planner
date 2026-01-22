import { FollowUpCreator } from "../../../src/core/services/follow-up-creator";
import { DEFAULT_SETTINGS, TaskPlannerSettings } from "../../../src/settings/types";
import { FileAdapter, TodoItem, TodoStatus } from "../../../src/types";

describe("FollowUpCreator", () => {
  let settings: TaskPlannerSettings;
  let followUpCreator: FollowUpCreator<string>;

  function createMockFileAdapter(content: string): FileAdapter<string> & { content: string } {
    const adapter = {
      file: "test-file",
      name: "test.md",
      path: "test.md",
      id: "test-file-id",
      content,
      getContent: jest.fn().mockImplementation(() => Promise.resolve(adapter.content)),
      setContent: jest.fn().mockImplementation((val: string) => {
        adapter.content = val;
        return Promise.resolve();
      }),
      isInFolder: jest.fn().mockReturnValue(false),
    };
    return adapter;
  }

  function createMockTodo(
    overrides: Partial<TodoItem<string>> = {},
    fileContent = "- [ ] Original task\n"
  ): TodoItem<string> {
    return {
      status: TodoStatus.Todo,
      text: "Original task",
      file: createMockFileAdapter(fileContent),
      line: 0,
      ...overrides,
    };
  }

  beforeEach(() => {
    settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    followUpCreator = new FollowUpCreator<string>(settings);
  });

  describe("formatTaskLine", () => {
    it("should format basic task line", () => {
      const result = followUpCreator.formatTaskLine("Test task", {}, []);

      expect(result).toBe("- [ ] Test task");
    });

    it("should include tags", () => {
      const result = followUpCreator.formatTaskLine("Test task", {}, ["work", "urgent"]);

      expect(result).toBe("- [ ] Test task #work #urgent");
    });

    it("should include attributes", () => {
      const result = followUpCreator.formatTaskLine("Test task", { due: "2026-01-21", priority: "high" }, []);

      expect(result).toBe("- [ ] Test task [due:: 2026-01-21] [priority:: high]");
    });

    it("should include both tags and attributes", () => {
      const result = followUpCreator.formatTaskLine("Test task", { due: "2026-01-21" }, ["work"]);

      expect(result).toBe("- [ ] Test task #work [due:: 2026-01-21]");
    });

    it("should handle boolean attributes", () => {
      const result = followUpCreator.formatTaskLine("Test task", { selected: true }, []);

      expect(result).toBe("- [ ] Test task [selected:: true]");
    });
  });

  describe("text prefix", () => {
    it("should apply default prefix", async () => {
      const todo = createMockTodo();

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("- [ ] Follow up: Original task");
    });

    it("should apply custom prefix", async () => {
      settings.followUp.textPrefix = "FU: ";
      followUpCreator = new FollowUpCreator<string>(settings);
      const todo = createMockTodo();

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("- [ ] FU: Original task");
    });

    it("should work with empty prefix", async () => {
      settings.followUp.textPrefix = "";
      followUpCreator = new FollowUpCreator<string>(settings);
      const todo = createMockTodo();

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("- [ ] Original task");
    });

    it("should add space after prefix without trailing space", async () => {
      settings.followUp.textPrefix = "FU:";
      followUpCreator = new FollowUpCreator<string>(settings);
      const todo = createMockTodo();

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("- [ ] FU: Original task");
    });

    it("should strip existing prefix to avoid double-prefixing", async () => {
      settings.followUp.textPrefix = "Follow up: ";
      followUpCreator = new FollowUpCreator<string>(settings);
      const todo = createMockTodo({ text: "Follow up: Original task" });

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("- [ ] Follow up: Original task");
      expect(newContent).not.toContain("Follow up: Follow up:");
    });

    it("should strip existing prefix without trailing space", async () => {
      settings.followUp.textPrefix = "FU:";
      followUpCreator = new FollowUpCreator<string>(settings);
      const todo = createMockTodo({ text: "FU: Already prefixed" });

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("- [ ] FU: Already prefixed");
      expect(newContent).not.toContain("FU: FU:");
    });

    it("should not strip text that only partially matches prefix", async () => {
      settings.followUp.textPrefix = "Follow up: ";
      followUpCreator = new FollowUpCreator<string>(settings);
      const todo = createMockTodo({ text: "Following the plan" });

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("- [ ] Follow up: Following the plan");
    });

    it("should handle whitespace-only prefix by returning text unchanged", async () => {
      // Tests line 35: when trimmedPrefix is empty (prefix is all whitespace)
      settings.followUp.textPrefix = "   ";
      followUpCreator = new FollowUpCreator<string>(settings);
      const todo = createMockTodo({ text: "Task with spaces prefix" });

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      // Whitespace-only prefix should result in just the task text (with the whitespace prefix)
      expect(newContent).toContain("- [ ]    Task with spaces prefix");
    });

    it("should strip prefix without trailing space when text starts directly with prefix", async () => {
      // Tests line 42: text.startsWith(trimmedPrefix) but NOT text.startsWith(trimmedPrefix + " ")
      settings.followUp.textPrefix = "FU:";
      followUpCreator = new FollowUpCreator<string>(settings);
      // Text starts with "FU:" but directly followed by text without space
      const todo = createMockTodo({ text: "FU:NoSpaceAfter" });

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      // Should strip the prefix and add it back with proper spacing
      expect(newContent).toContain("- [ ] FU: NoSpaceAfter");
      expect(newContent).not.toContain("FU: FU:");
    });
  });

  describe("copy tags", () => {
    it("should copy tags when enabled", async () => {
      settings.followUp.copyTags = true;
      followUpCreator = new FollowUpCreator<string>(settings);
      const todo = createMockTodo({ tags: ["work", "important"] });

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("#work");
      expect(newContent).toContain("#important");
    });

    it("should not copy tags when disabled", async () => {
      settings.followUp.copyTags = false;
      followUpCreator = new FollowUpCreator<string>(settings);
      const todo = createMockTodo({ tags: ["work", "important"] });

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).not.toContain("#work");
      expect(newContent).not.toContain("#important");
    });

    it("should handle undefined tags", async () => {
      settings.followUp.copyTags = true;
      followUpCreator = new FollowUpCreator<string>(settings);
      const todo = createMockTodo({ tags: undefined });

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("- [ ] Follow up: Original task");
    });
  });

  describe("copy priority", () => {
    it("should copy priority by default", async () => {
      const todo = createMockTodo({ attributes: { priority: "high" } });

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("[priority:: high]");
    });

    it("should copy priority when enabled", async () => {
      settings.followUp.copyPriority = true;
      followUpCreator = new FollowUpCreator<string>(settings);
      const todo = createMockTodo({ attributes: { priority: "high" } });

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("[priority:: high]");
    });

    it("should handle missing priority attribute", async () => {
      settings.followUp.copyPriority = true;
      followUpCreator = new FollowUpCreator<string>(settings);
      const todo = createMockTodo({ attributes: {} });

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).not.toContain("[priority::");
    });
  });

  describe("due date", () => {
    it("should set due date when provided", async () => {
      const todo = createMockTodo();

      await followUpCreator.createFollowUp(todo, "2026-01-21");

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("[due:: 2026-01-21]");
    });

    it("should not set due date for backlog (null)", async () => {
      const todo = createMockTodo();

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).not.toContain("[due::");
    });

    it("should use custom due date attribute name", async () => {
      settings.dueDateAttribute = "scheduled";
      followUpCreator = new FollowUpCreator<string>(settings);
      const todo = createMockTodo();

      await followUpCreator.createFollowUp(todo, "2026-01-21");

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("[scheduled:: 2026-01-21]");
    });
  });

  describe("insertAfterOriginal", () => {
    it("should insert after original task", async () => {
      const fileContent = "- [ ] Original task\n- [ ] Another task\n";
      const todo = createMockTodo({}, fileContent);

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      const lines = newContent.split("\n");
      expect(lines[0]).toBe("- [ ] Original task");
      expect(lines[1]).toContain("Follow up: Original task");
      expect(lines[2]).toBe("- [ ] Another task");
    });

    it("should insert after subtasks", async () => {
      const fileContent = "- [ ] Original task\n  - [ ] Subtask 1\n  - [ ] Subtask 2\n- [ ] Next task\n";
      const todo = createMockTodo({}, fileContent);

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      const lines = newContent.split("\n");
      expect(lines[0]).toBe("- [ ] Original task");
      expect(lines[1]).toBe("  - [ ] Subtask 1");
      expect(lines[2]).toBe("  - [ ] Subtask 2");
      expect(lines[3]).toContain("Follow up: Original task");
      expect(lines[4]).toBe("- [ ] Next task");
    });

    it("should handle task at last line of file", async () => {
      const fileContent = "- [ ] First task\n- [ ] Original task";
      const todo = createMockTodo({ line: 1 }, fileContent);

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      const lines = newContent.split("\n");
      expect(lines[1]).toBe("- [ ] Original task");
      expect(lines[2]).toContain("Follow up: Original task");
    });

    it("should preserve LF line endings", async () => {
      const fileContent = "- [ ] Original task\n- [ ] Another task\n";
      const todo = createMockTodo({}, fileContent);

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).not.toContain("\r\n");
      expect(newContent.split("\n").length).toBe(4);
    });

    it("should preserve CRLF line endings", async () => {
      const fileContent = "- [ ] Original task\r\n- [ ] Another task\r\n";
      const todo = createMockTodo({}, fileContent);

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("\r\n");
      expect(newContent.split("\r\n").length).toBe(4);
    });

    it("should preserve original task indentation", async () => {
      const fileContent = "# Tasks\n  - [ ] Indented task\n  - [ ] Another indented\n";
      const todo = createMockTodo({ line: 1, text: "Indented task" }, fileContent);

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      const lines = newContent.split("\n");
      expect(lines[2]).toBe("  - [ ] Follow up: Indented task");
    });

    it("should throw error when line number is undefined", async () => {
      const todo = createMockTodo({ line: undefined });

      await expect(followUpCreator.createFollowUp(todo, null)).rejects.toThrow(
        "Cannot insert follow-up: original task has no line number"
      );
    });

    it("should stop at empty lines when finding subtasks", async () => {
      const fileContent = "- [ ] Original task\n\n- [ ] Next task\n";
      const todo = createMockTodo({}, fileContent);

      await followUpCreator.createFollowUp(todo, null);

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      const lines = newContent.split("\n");
      expect(lines[0]).toBe("- [ ] Original task");
      expect(lines[1]).toContain("Follow up: Original task");
      expect(lines[2]).toBe("");
      expect(lines[3]).toBe("- [ ] Next task");
    });
  });

  describe("combined settings", () => {
    it("should apply all settings correctly", async () => {
      settings.followUp.textPrefix = "FU: ";
      settings.followUp.copyTags = true;
      settings.followUp.copyPriority = true;
      settings.dueDateAttribute = "due";
      followUpCreator = new FollowUpCreator<string>(settings);

      const todo = createMockTodo({
        text: "Important meeting",
        tags: ["work", "meeting"],
        attributes: { priority: "high" },
      });

      await followUpCreator.createFollowUp(todo, "2026-01-22");

      const newContent = (todo.file as ReturnType<typeof createMockFileAdapter>).content;
      expect(newContent).toContain("- [ ] FU: Important meeting #work #meeting [due:: 2026-01-22] [priority:: high]");
    });
  });
});
