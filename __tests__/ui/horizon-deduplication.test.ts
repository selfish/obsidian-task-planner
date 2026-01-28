import { HorizonDeduplicator, filterTodosByTag } from "../../src/ui/horizon-deduplication";
import { TaskItem, TaskStatus } from "../../src/types/task";
import { FileAdapter } from "../../src/types/file-adapter";

const createMockFileAdapter = (id: string, path: string): FileAdapter<unknown> => ({
  id,
  path,
  getContents: jest.fn().mockResolvedValue(""),
  save: jest.fn().mockResolvedValue(undefined),
  createOrSave: jest.fn().mockResolvedValue(undefined),
  file: {},
});

function createTodo(options: {
  id: string;
  text: string;
  line?: number;
  tags?: string[];
  status?: TaskStatus;
  attributes?: Record<string, string | boolean>;
}): TaskItem<unknown> {
  return {
    status: options.status ?? TaskStatus.Todo,
    text: options.text,
    file: createMockFileAdapter(options.id, `notes/${options.id}.md`),
    line: options.line ?? 1,
    tags: options.tags,
    attributes: options.attributes,
  };
}

describe("HorizonDeduplicator", () => {
  describe("markAsAssigned", () => {
    it("should mark todos as assigned", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();
      const todo1 = createTodo({ id: "file-1", text: "Task 1", line: 1 });
      const todo2 = createTodo({ id: "file-2", text: "Task 2", line: 2 });

      deduplicator.markAsAssigned([todo1, todo2]);

      expect(deduplicator.isAssigned(todo1)).toBe(true);
      expect(deduplicator.isAssigned(todo2)).toBe(true);
    });

    it("should handle empty array", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();

      deduplicator.markAsAssigned([]);

      expect(deduplicator.assignedCount).toBe(0);
    });

    it("should not duplicate when marking the same todo twice", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();
      const todo = createTodo({ id: "file-1", text: "Task 1", line: 1 });

      deduplicator.markAsAssigned([todo]);
      deduplicator.markAsAssigned([todo]);

      expect(deduplicator.assignedCount).toBe(1);
    });
  });

  describe("isAssigned", () => {
    it("should return false for unassigned todo", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();
      const todo = createTodo({ id: "file-1", text: "Task 1", line: 1 });

      expect(deduplicator.isAssigned(todo)).toBe(false);
    });

    it("should return true for assigned todo", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();
      const todo = createTodo({ id: "file-1", text: "Task 1", line: 1 });

      deduplicator.markAsAssigned([todo]);

      expect(deduplicator.isAssigned(todo)).toBe(true);
    });

    it("should differentiate todos by file, line, and text", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();
      const todo1 = createTodo({ id: "file-1", text: "Task 1", line: 1 });
      const todo2 = createTodo({ id: "file-1", text: "Task 1", line: 2 }); // Different line
      const todo3 = createTodo({ id: "file-1", text: "Task 2", line: 1 }); // Different text
      const todo4 = createTodo({ id: "file-2", text: "Task 1", line: 1 }); // Different file

      deduplicator.markAsAssigned([todo1]);

      expect(deduplicator.isAssigned(todo1)).toBe(true);
      expect(deduplicator.isAssigned(todo2)).toBe(false);
      expect(deduplicator.isAssigned(todo3)).toBe(false);
      expect(deduplicator.isAssigned(todo4)).toBe(false);
    });
  });

  describe("filterExcluded", () => {
    it("should return all todos when none are assigned", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();
      const todos = [
        createTodo({ id: "file-1", text: "Task 1", line: 1 }),
        createTodo({ id: "file-2", text: "Task 2", line: 2 }),
      ];

      const result = deduplicator.filterExcluded(todos);

      expect(result).toHaveLength(2);
    });

    it("should filter out assigned todos", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();
      const todo1 = createTodo({ id: "file-1", text: "Task 1", line: 1 });
      const todo2 = createTodo({ id: "file-2", text: "Task 2", line: 2 });
      const todo3 = createTodo({ id: "file-3", text: "Task 3", line: 3 });

      deduplicator.markAsAssigned([todo1]);

      const result = deduplicator.filterExcluded([todo1, todo2, todo3]);

      expect(result).toHaveLength(2);
      expect(result).toContain(todo2);
      expect(result).toContain(todo3);
      expect(result).not.toContain(todo1);
    });

    it("should return empty array when all todos are assigned", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();
      const todo1 = createTodo({ id: "file-1", text: "Task 1", line: 1 });
      const todo2 = createTodo({ id: "file-2", text: "Task 2", line: 2 });

      deduplicator.markAsAssigned([todo1, todo2]);

      const result = deduplicator.filterExcluded([todo1, todo2]);

      expect(result).toHaveLength(0);
    });
  });

  describe("filterAndMark", () => {
    it("should filter out assigned todos and mark remaining as assigned", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();
      const todo1 = createTodo({ id: "file-1", text: "Task 1", line: 1 });
      const todo2 = createTodo({ id: "file-2", text: "Task 2", line: 2 });
      const todo3 = createTodo({ id: "file-3", text: "Task 3", line: 3 });

      // First horizon gets todo1
      deduplicator.markAsAssigned([todo1]);

      // Second horizon processes all todos
      const result = deduplicator.filterAndMark([todo1, todo2, todo3]);

      expect(result).toHaveLength(2);
      expect(result).toContain(todo2);
      expect(result).toContain(todo3);

      // All should now be assigned
      expect(deduplicator.isAssigned(todo1)).toBe(true);
      expect(deduplicator.isAssigned(todo2)).toBe(true);
      expect(deduplicator.isAssigned(todo3)).toBe(true);
    });

    it("should support chained calls for multiple horizons", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();
      const todo1 = createTodo({ id: "file-1", text: "Task 1", line: 1 });
      const todo2 = createTodo({ id: "file-2", text: "Task 2", line: 2 });
      const todo3 = createTodo({ id: "file-3", text: "Task 3", line: 3 });

      // Simulate custom horizon taking todo1
      const customHorizonTodos = deduplicator.filterAndMark([todo1]);
      expect(customHorizonTodos).toEqual([todo1]);

      // Simulate standard horizon processing all todos
      const standardHorizonTodos = deduplicator.filterAndMark([todo1, todo2, todo3]);
      expect(standardHorizonTodos).toHaveLength(2);
      expect(standardHorizonTodos).toContain(todo2);
      expect(standardHorizonTodos).toContain(todo3);

      // Simulate later horizon - should get nothing
      const laterHorizonTodos = deduplicator.filterAndMark([todo1, todo2, todo3]);
      expect(laterHorizonTodos).toHaveLength(0);
    });
  });

  describe("getExclusionSet", () => {
    it("should return a Set containing assigned task IDs", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();
      const todo1 = createTodo({ id: "file-1", text: "Task 1", line: 1 });
      const todo2 = createTodo({ id: "file-2", text: "Task 2", line: 2 });

      deduplicator.markAsAssigned([todo1, todo2]);

      const exclusionSet = deduplicator.getExclusionSet();

      expect(exclusionSet.size).toBe(2);
      expect(exclusionSet.has("file-1-1-Task 1")).toBe(true);
      expect(exclusionSet.has("file-2-2-Task 2")).toBe(true);
    });
  });

  describe("reset", () => {
    it("should clear all assigned task IDs", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();
      const todo = createTodo({ id: "file-1", text: "Task 1", line: 1 });

      deduplicator.markAsAssigned([todo]);
      expect(deduplicator.assignedCount).toBe(1);

      deduplicator.reset();

      expect(deduplicator.assignedCount).toBe(0);
      expect(deduplicator.isAssigned(todo)).toBe(false);
    });
  });

  describe("assignedCount", () => {
    it("should return 0 for new deduplicator", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();

      expect(deduplicator.assignedCount).toBe(0);
    });

    it("should return correct count after marking todos", () => {
      const deduplicator = new HorizonDeduplicator<unknown>();
      const todos = [
        createTodo({ id: "file-1", text: "Task 1", line: 1 }),
        createTodo({ id: "file-2", text: "Task 2", line: 2 }),
        createTodo({ id: "file-3", text: "Task 3", line: 3 }),
      ];

      deduplicator.markAsAssigned(todos);

      expect(deduplicator.assignedCount).toBe(3);
    });
  });
});

describe("filterTodosByTag", () => {
  it("should return only todos with the specified tag", () => {
    const todos = [
      createTodo({ id: "file-1", text: "Task 1", tags: ["work", "urgent"] }),
      createTodo({ id: "file-2", text: "Task 2", tags: ["personal"] }),
      createTodo({ id: "file-3", text: "Task 3", tags: ["work"] }),
    ];

    const result = filterTodosByTag(todos, "work");

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Task 1");
    expect(result[1].text).toBe("Task 3");
  });

  it("should return empty array when no todos have the tag", () => {
    const todos = [
      createTodo({ id: "file-1", text: "Task 1", tags: ["work"] }),
      createTodo({ id: "file-2", text: "Task 2", tags: ["personal"] }),
    ];

    const result = filterTodosByTag(todos, "urgent");

    expect(result).toHaveLength(0);
  });

  it("should handle todos without tags", () => {
    const todos = [
      createTodo({ id: "file-1", text: "Task 1", tags: ["work"] }),
      createTodo({ id: "file-2", text: "Task 2" }), // No tags
      createTodo({ id: "file-3", text: "Task 3", tags: undefined }),
    ];

    const result = filterTodosByTag(todos, "work");

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Task 1");
  });

  it("should handle empty tags array", () => {
    const todos = [
      createTodo({ id: "file-1", text: "Task 1", tags: [] }),
      createTodo({ id: "file-2", text: "Task 2", tags: ["work"] }),
    ];

    const result = filterTodosByTag(todos, "work");

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Task 2");
  });
});

describe("Horizon deduplication integration scenarios", () => {
  it("should prevent task from appearing in both custom horizon and standard horizon", () => {
    const deduplicator = new HorizonDeduplicator<unknown>();

    // Task with due date 2026-01-25 (tomorrow) and tag #meeting
    const meetingTask = createTodo({
      id: "file-1",
      text: "Meeting with team",
      tags: ["meeting"],
      attributes: { due: "2026-01-25" },
    });

    // Regular task for tomorrow without tag
    const regularTask = createTodo({
      id: "file-2",
      text: "Review code",
      attributes: { due: "2026-01-25" },
    });

    // Simulate custom horizon with tag filter
    const customHorizonTodos = [meetingTask, regularTask];
    const tagFilteredTodos = filterTodosByTag(customHorizonTodos, "meeting");
    const customHorizonResult = deduplicator.filterAndMark(tagFilteredTodos);

    expect(customHorizonResult).toHaveLength(1);
    expect(customHorizonResult[0].text).toBe("Meeting with team");

    // Simulate Tomorrow standard horizon
    const tomorrowTodos = [meetingTask, regularTask];
    const tomorrowResult = deduplicator.filterAndMark(tomorrowTodos);

    // Only regular task should appear (meeting task was assigned to custom horizon)
    expect(tomorrowResult).toHaveLength(1);
    expect(tomorrowResult[0].text).toBe("Review code");
  });

  it("should respect horizon priority order: custom before > overdue > today > tomorrow > weeks > months", () => {
    const deduplicator = new HorizonDeduplicator<unknown>();

    const task = createTodo({ id: "file-1", text: "Important task", line: 1 });

    // Simulate processing horizons in order
    const customBeforeTodos = deduplicator.filterAndMark([task]);
    expect(customBeforeTodos).toHaveLength(1);

    const overdueTodos = deduplicator.filterAndMark([task]);
    expect(overdueTodos).toHaveLength(0);

    const todayTodos = deduplicator.filterAndMark([task]);
    expect(todayTodos).toHaveLength(0);

    const tomorrowTodos = deduplicator.filterAndMark([task]);
    expect(tomorrowTodos).toHaveLength(0);
  });

  it("should handle multiple custom horizons with different tags on same date", () => {
    const deduplicator = new HorizonDeduplicator<unknown>();

    const workTask = createTodo({
      id: "file-1",
      text: "Work meeting",
      tags: ["work"],
      attributes: { due: "2026-01-25" },
    });

    const personalTask = createTodo({
      id: "file-2",
      text: "Doctor appointment",
      tags: ["personal"],
      attributes: { due: "2026-01-25" },
    });

    const plainTask = createTodo({
      id: "file-3",
      text: "Regular task",
      attributes: { due: "2026-01-25" },
    });

    // Custom horizon for "work" tag
    const allTasks = [workTask, personalTask, plainTask];
    const workFiltered = filterTodosByTag(allTasks, "work");
    const workHorizonResult = deduplicator.filterAndMark(workFiltered);

    expect(workHorizonResult).toHaveLength(1);
    expect(workHorizonResult[0].text).toBe("Work meeting");

    // Custom horizon for "personal" tag
    const personalFiltered = filterTodosByTag(allTasks, "personal");
    const personalHorizonResult = deduplicator.filterAndMark(personalFiltered);

    expect(personalHorizonResult).toHaveLength(1);
    expect(personalHorizonResult[0].text).toBe("Doctor appointment");

    // Standard horizon should only get the plain task
    const standardHorizonResult = deduplicator.filterAndMark(allTasks);

    expect(standardHorizonResult).toHaveLength(1);
    expect(standardHorizonResult[0].text).toBe("Regular task");
  });

  it("should preserve order of remaining tasks after filtering", () => {
    const deduplicator = new HorizonDeduplicator<unknown>();

    const task1 = createTodo({ id: "file-1", text: "First task", line: 1 });
    const task2 = createTodo({ id: "file-2", text: "Second task", line: 2 });
    const task3 = createTodo({ id: "file-3", text: "Third task", line: 3 });
    const task4 = createTodo({ id: "file-4", text: "Fourth task", line: 4 });

    // Custom horizon takes task2
    deduplicator.markAsAssigned([task2]);

    // Standard horizon filters out task2
    const result = deduplicator.filterExcluded([task1, task2, task3, task4]);

    expect(result).toHaveLength(3);
    expect(result[0].text).toBe("First task");
    expect(result[1].text).toBe("Third task");
    expect(result[2].text).toBe("Fourth task");
  });

  describe("custom horizon priority over builtins", () => {
    it("should allow custom horizon to claim tasks before builtin processes", () => {
      // This tests the scenario where:
      // - A task has due date April 1st and tag #event
      // - Custom horizon: "April Event" (April 1st + #event) positioned at "end"
      // - Builtin horizon: "April" (April 1-30)
      //
      // Even though custom horizon is visually at the end, it should still claim
      // its matching tasks before the builtin "April" horizon

      const deduplicator = new HorizonDeduplicator<unknown>();

      const aprilEventTask = createTodo({
        id: "file-1",
        text: "April Event planning",
        tags: ["event"],
        attributes: { due: "2026-04-01" },
      });

      const aprilRegularTask = createTodo({
        id: "file-2",
        text: "April regular task",
        attributes: { due: "2026-04-15" },
      });

      // Pre-claim: Custom horizons process first (this is the key behavior)
      // Custom horizon for April 1st with #event tag
      const eventTaggedTasks = filterTodosByTag([aprilEventTask, aprilRegularTask], "event");
      const customHorizonClaimed = deduplicator.filterAndMark(eventTaggedTasks);

      expect(customHorizonClaimed).toHaveLength(1);
      expect(customHorizonClaimed[0].text).toBe("April Event planning");

      // Builtin "April" horizon processes later but task is already claimed
      const aprilBuiltinResult = deduplicator.filterAndMark([aprilEventTask, aprilRegularTask]);

      expect(aprilBuiltinResult).toHaveLength(1);
      expect(aprilBuiltinResult[0].text).toBe("April regular task");
    });

    it("should handle inline custom horizon claiming before builtin at same date", () => {
      // Tests the "inline" position scenario:
      // - Custom horizon for April 1st should appear before the "April" builtin
      // - And should claim its matching tasks

      const deduplicator = new HorizonDeduplicator<unknown>();

      const april1stTask = createTodo({
        id: "file-1",
        text: "Important April 1st task",
        attributes: { due: "2026-04-01" },
      });

      const april15thTask = createTodo({
        id: "file-2",
        text: "Mid-April task",
        attributes: { due: "2026-04-15" },
      });

      // Simulate pre-claiming: All custom horizons process their matches first
      // Custom horizon targeting April 1st specifically
      const april1stMatches = [april1stTask]; // Only the April 1st task matches
      const customHorizonClaimed = deduplicator.filterAndMark(april1stMatches);

      expect(customHorizonClaimed).toHaveLength(1);
      expect(customHorizonClaimed[0].text).toBe("Important April 1st task");

      // When rendering in visual order, builtin April horizon won't get the April 1st task
      const aprilBuiltinResult = deduplicator.filterAndMark([april1stTask, april15thTask]);

      expect(aprilBuiltinResult).toHaveLength(1);
      expect(aprilBuiltinResult[0].text).toBe("Mid-April task");
    });

    it("should claim tasks in custom horizon definition order", () => {
      // If two custom horizons could both match a task, first one wins
      const deduplicator = new HorizonDeduplicator<unknown>();

      const task = createTodo({
        id: "file-1",
        text: "Dual-tagged task",
        tags: ["work", "urgent"],
        attributes: { due: "2026-04-01" },
      });

      // First custom horizon: "Work" tag
      const workFiltered = filterTodosByTag([task], "work");
      const workHorizonResult = deduplicator.filterAndMark(workFiltered);
      expect(workHorizonResult).toHaveLength(1);

      // Second custom horizon: "Urgent" tag (same task, but already claimed)
      const urgentFiltered = filterTodosByTag([task], "urgent");
      const urgentHorizonResult = deduplicator.filterAndMark(urgentFiltered);
      expect(urgentHorizonResult).toHaveLength(0);
    });
  });
});
