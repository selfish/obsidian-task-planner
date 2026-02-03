import {
  TaskSpreader,
  getTaskPriority,
  getSpreadWeight,
  canTaskBeMoved,
  DEFAULT_PRIORITY_WEIGHT,
} from "../../../src/core/services/task-spreader";
import { TaskItem, TaskStatus } from "../../../src/types/task";
import { DEFAULT_SETTINGS } from "../../../src/settings/types";
import { moment } from "../../../src/utils/moment";

// Helper to create a mock task
function createMockTask(overrides: Partial<TaskItem<unknown>> = {}): TaskItem<unknown> {
  return {
    status: TaskStatus.Todo,
    text: "Test task",
    file: {
      id: "test-file",
      file: {} as unknown,
      path: "test.md",
    } as TaskItem<unknown>["file"],
    attributes: {},
    ...overrides,
  };
}

describe("TaskSpreader", () => {
  describe("getTaskPriority", () => {
    it("should return null for tasks without priority", () => {
      const task = createMockTask();
      expect(getTaskPriority(task)).toBeNull();
    });

    it("should return priority from priority attribute", () => {
      const task = createMockTask({ attributes: { priority: "high" } });
      expect(getTaskPriority(task)).toBe("high");
    });

    it("should return priority from importance attribute", () => {
      const task = createMockTask({ attributes: { importance: "critical" } });
      expect(getTaskPriority(task)).toBe("critical");
    });

    it("should normalize priority to lowercase", () => {
      const task = createMockTask({ attributes: { priority: "HIGH" } });
      expect(getTaskPriority(task)).toBe("high");
    });

    it("should return null for invalid priority values", () => {
      const task = createMockTask({ attributes: { priority: "urgent" } });
      expect(getTaskPriority(task)).toBeNull();
    });
  });

  describe("getSpreadWeight", () => {
    it("should return 0 for critical priority", () => {
      const task = createMockTask({ attributes: { priority: "critical" } });
      expect(getSpreadWeight(task)).toBe(0);
    });

    it("should return 0 for highest priority", () => {
      const task = createMockTask({ attributes: { priority: "highest" } });
      expect(getSpreadWeight(task)).toBe(0);
    });

    it("should return 1 for high priority", () => {
      const task = createMockTask({ attributes: { priority: "high" } });
      expect(getSpreadWeight(task)).toBe(1);
    });

    it("should return 2 for medium priority", () => {
      const task = createMockTask({ attributes: { priority: "medium" } });
      expect(getSpreadWeight(task)).toBe(2);
    });

    it("should return 3 for low priority", () => {
      const task = createMockTask({ attributes: { priority: "low" } });
      expect(getSpreadWeight(task)).toBe(3);
    });

    it("should return 5 for lowest priority", () => {
      const task = createMockTask({ attributes: { priority: "lowest" } });
      expect(getSpreadWeight(task)).toBe(5);
    });

    it("should return default weight for tasks without priority", () => {
      const task = createMockTask();
      expect(getSpreadWeight(task)).toBe(DEFAULT_PRIORITY_WEIGHT);
    });
  });

  describe("canTaskBeMoved", () => {
    it("should return false for critical priority when preserveCritical is true", () => {
      const task = createMockTask({ attributes: { priority: "critical" } });
      expect(canTaskBeMoved(task, true)).toBe(false);
    });

    it("should return false for highest priority when preserveCritical is true", () => {
      const task = createMockTask({ attributes: { priority: "highest" } });
      expect(canTaskBeMoved(task, true)).toBe(false);
    });

    it("should return true for high priority", () => {
      const task = createMockTask({ attributes: { priority: "high" } });
      expect(canTaskBeMoved(task, true)).toBe(true);
    });

    it("should return true for tasks without priority", () => {
      const task = createMockTask();
      expect(canTaskBeMoved(task, true)).toBe(true);
    });

    it("should return true for critical when preserveCritical is false", () => {
      const task = createMockTask({ attributes: { priority: "critical" } });
      expect(canTaskBeMoved(task, false)).toBe(true);
    });
  });

  describe("TaskSpreader class", () => {
    let spreader: TaskSpreader<unknown>;
    const settings = {
      ...DEFAULT_SETTINGS,
      dailyWipLimit: 3,
      horizonVisibility: {
        ...DEFAULT_SETTINGS.horizonVisibility,
        showMonday: true,
        showTuesday: true,
        showWednesday: true,
        showThursday: true,
        showFriday: true,
        showSaturday: false,
        showSunday: false,
      },
    };

    beforeEach(() => {
      spreader = new TaskSpreader(settings);
    });

    describe("getAvailableWorkdays", () => {
      it("should return only enabled weekdays", () => {
        // Start on a Monday
        const start = moment("2025-02-03"); // Monday
        const end = moment("2025-02-10"); // Next Monday

        const workdays = spreader.getAvailableWorkdays(start, end);

        // Should have Mon-Fri (5 days), excluding Sat/Sun
        expect(workdays.length).toBe(5);
        expect(workdays[0].format("dddd")).toBe("Monday");
        expect(workdays[4].format("dddd")).toBe("Friday");
      });

      it("should return empty array for weekend-only range when weekends disabled", () => {
        const start = moment("2025-02-08"); // Saturday
        const end = moment("2025-02-10"); // Monday

        const workdays = spreader.getAvailableWorkdays(start, end);

        expect(workdays.length).toBe(0);
      });
    });

    describe("analyzeWorkload", () => {
      it("should identify overloaded days", () => {
        const monday = moment("2025-02-03");
        const tasks = [
          createMockTask({ attributes: { due: "2025-02-03" } }),
          createMockTask({ attributes: { due: "2025-02-03" } }),
          createMockTask({ attributes: { due: "2025-02-03" } }),
          createMockTask({ attributes: { due: "2025-02-03" } }), // 4 tasks, over limit of 3
          createMockTask({ attributes: { due: "2025-02-04" } }), // 1 task on Tuesday
        ];

        const analysis = spreader.analyzeWorkload(tasks, monday, monday.clone().add(7, "days"));

        expect(analysis.hotspots.length).toBe(1);
        expect(analysis.hotspots[0].dateStr).toBe("2025-02-03");
        expect(analysis.hotspots[0].taskCount).toBe(4);
      });

      it("should calculate available capacity", () => {
        const monday = moment("2025-02-03");
        const tasks = [
          createMockTask({ attributes: { due: "2025-02-03" } }),
          createMockTask({ attributes: { due: "2025-02-04" } }),
          createMockTask({ attributes: { due: "2025-02-04" } }),
        ];

        const analysis = spreader.analyzeWorkload(tasks, monday, monday.clone().add(7, "days"));

        const mondayLoad = analysis.days.find((d) => d.dateStr === "2025-02-03");
        const tuesdayLoad = analysis.days.find((d) => d.dateStr === "2025-02-04");

        expect(mondayLoad?.availableCapacity).toBe(2); // 3 - 1 = 2
        expect(tuesdayLoad?.availableCapacity).toBe(1); // 3 - 2 = 1
      });

      it("should skip completed tasks", () => {
        const monday = moment("2025-02-03");
        const tasks = [
          createMockTask({ attributes: { due: "2025-02-03" }, status: TaskStatus.Complete }),
          createMockTask({ attributes: { due: "2025-02-03" }, status: TaskStatus.Canceled }),
          createMockTask({ attributes: { due: "2025-02-03" } }), // Only this one counts
        ];

        const analysis = spreader.analyzeWorkload(tasks, monday, monday.clone().add(7, "days"));

        const mondayLoad = analysis.days.find((d) => d.dateStr === "2025-02-03");
        expect(mondayLoad?.taskCount).toBe(1);
      });
    });

    describe("planSpread", () => {
      it("should not move critical priority tasks", () => {
        const monday = moment("2025-02-03");
        const tasks = [
          createMockTask({ attributes: { due: "2025-02-03", priority: "critical" } }),
          createMockTask({ attributes: { due: "2025-02-03", priority: "critical" } }),
          createMockTask({ attributes: { due: "2025-02-03", priority: "critical" } }),
          createMockTask({ attributes: { due: "2025-02-03", priority: "critical" } }),
        ];

        const result = spreader.planSpread(tasks, { sourceDate: monday });

        expect(result.moves.length).toBe(0);
        expect(result.summary.tasksKept).toBe(4);
      });

      it("should move low priority tasks before high priority", () => {
        const monday = moment("2025-02-03");
        const tasks = [
          createMockTask({ text: "High", attributes: { due: "2025-02-03", priority: "high" } }),
          createMockTask({ text: "Low", attributes: { due: "2025-02-03", priority: "low" } }),
          createMockTask({ text: "Medium", attributes: { due: "2025-02-03", priority: "medium" } }),
          createMockTask({ text: "Lowest", attributes: { due: "2025-02-03", priority: "lowest" } }),
        ];

        const result = spreader.planSpread(tasks, { sourceDate: monday });

        // With WIP limit of 3, we need to move 1 task
        // Lowest priority should be moved first
        expect(result.moves.length).toBe(1);
        expect((result.moves[0].task as TaskItem<unknown>).text).toBe("Lowest");
      });

      it("should spread tasks to available days", () => {
        const monday = moment("2025-02-03");
        const tasks = [
          createMockTask({ attributes: { due: "2025-02-03" } }),
          createMockTask({ attributes: { due: "2025-02-03" } }),
          createMockTask({ attributes: { due: "2025-02-03" } }),
          createMockTask({ attributes: { due: "2025-02-03" } }),
          createMockTask({ attributes: { due: "2025-02-03" } }), // 5 tasks, need to move 2
        ];

        const result = spreader.planSpread(tasks, { sourceDate: monday });

        expect(result.moves.length).toBe(2);
        // Tasks should be moved to Tuesday (next available day)
        expect(result.moves[0].toDate).toBe("2025-02-04");
      });

      it("should return empty result for empty source day", () => {
        const monday = moment("2025-02-03");
        const tasks: TaskItem<unknown>[] = [];

        const result = spreader.planSpread(tasks, { sourceDate: monday });

        expect(result.moves.length).toBe(0);
        expect(result.summary.tasksSpread).toBe(0);
      });
    });

    describe("planWeekBalance", () => {
      it("should balance multiple hotspots in a week", () => {
        const monday = moment("2025-02-03");
        const tasks = [
          // Monday: 5 tasks (overloaded)
          createMockTask({ attributes: { due: "2025-02-03" } }),
          createMockTask({ attributes: { due: "2025-02-03" } }),
          createMockTask({ attributes: { due: "2025-02-03" } }),
          createMockTask({ attributes: { due: "2025-02-03" } }),
          createMockTask({ attributes: { due: "2025-02-03" } }),
          // Wednesday: 4 tasks (overloaded)
          createMockTask({ attributes: { due: "2025-02-05" } }),
          createMockTask({ attributes: { due: "2025-02-05" } }),
          createMockTask({ attributes: { due: "2025-02-05" } }),
          createMockTask({ attributes: { due: "2025-02-05" } }),
        ];

        const result = spreader.planWeekBalance(tasks, monday);

        // Should have moves from both hotspots
        expect(result.moves.length).toBeGreaterThan(0);
        expect(result.summary.tasksSpread).toBeGreaterThan(0);
      });
    });
  });
});
