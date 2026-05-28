import { TaskPlannerSettings, HorizonVisibility } from "../../settings/types";
import { TaskItem, TaskStatus } from "../../types/task";
import { Moment } from "../../utils/moment";
import { findTaskDate } from "../../utils/task-utils";

/**
 * Priority weights for spreading distance.
 * Higher weight = can be pushed further forward.
 * Critical/Highest = 0 means they never move.
 */
export const PRIORITY_SPREAD_WEIGHTS: Record<string, number> = {
  critical: 0,
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 5,
};

/** Default weight for tasks without priority */
export const DEFAULT_PRIORITY_WEIGHT = 4;

export interface SpreadOptions {
  /** The overloaded day to spread from */
  sourceDate: Moment;
  /** Optional: limit spread range */
  targetRange?: {
    start: Moment;
    end: Moment;
  };
  /** Use WIP limit as target per day (default: true) */
  respectWipLimit?: boolean;
  /** Keep critical/highest tasks in place (default: true) */
  preserveCritical?: boolean;
  /** Maximum days to look ahead for spreading (default: 14) */
  maxLookAheadDays?: number;
}

export interface TaskMove {
  task: TaskItem<unknown>;
  fromDate: string;
  toDate: string;
  priority: string | null;
}

export interface SpreadResult {
  moves: TaskMove[];
  summary: {
    tasksSpread: number;
    daysAffected: number;
    tasksKept: number;
  };
}

export interface DayLoad {
  date: Moment;
  dateStr: string;
  tasks: TaskItem<unknown>[];
  taskCount: number;
  isWorkday: boolean;
  isOverloaded: boolean;
  availableCapacity: number;
}

export interface WorkloadAnalysis {
  days: DayLoad[];
  hotspots: DayLoad[];
  totalTasks: number;
  averageLoad: number;
}

/**
 * Get the priority of a task, normalized to lowercase.
 */
export function getTaskPriority(task: TaskItem<unknown>): string | null {
  if (!task.attributes) return null;
  const priorityAttr = task.attributes["priority"] || task.attributes["importance"];
  if (typeof priorityAttr === "string") {
    const normalized = priorityAttr.toLowerCase();
    if (Object.keys(PRIORITY_SPREAD_WEIGHTS).includes(normalized)) {
      return normalized;
    }
  }
  return null;
}

/**
 * Get the spread weight for a task based on its priority.
 * Higher weight = can be pushed further.
 */
export function getSpreadWeight(task: TaskItem<unknown>): number {
  const priority = getTaskPriority(task);
  if (priority && priority in PRIORITY_SPREAD_WEIGHTS) {
    return PRIORITY_SPREAD_WEIGHTS[priority];
  }
  return DEFAULT_PRIORITY_WEIGHT;
}

/**
 * Check if a task can be moved (not critical/highest priority).
 */
export function canTaskBeMoved(task: TaskItem<unknown>, preserveCritical: boolean = true): boolean {
  if (!preserveCritical) return true;
  const weight = getSpreadWeight(task);
  return weight > 0;
}

/**
 * Service for analyzing workload and spreading tasks across days.
 */
export class TaskSpreader<TFile> {
  private settings: TaskPlannerSettings;

  constructor(settings: TaskPlannerSettings) {
    this.settings = settings;
  }

  /**
   * Get available workdays based on horizon visibility settings.
   */
  getAvailableWorkdays(start: Moment, end: Moment): Moment[] {
    const workdays: Moment[] = [];
    const { horizonVisibility } = this.settings;
    const current = start.clone();

    while (current.isBefore(end)) {
      if (this.isWorkday(current, horizonVisibility)) {
        workdays.push(current.clone());
      }
      current.add(1, "days");
    }

    return workdays;
  }

  /**
   * Check if a date is a workday based on settings.
   */
  private isWorkday(date: Moment, visibility: HorizonVisibility): boolean {
    const weekday = date.isoWeekday();
    const weekdayMap: Record<number, keyof HorizonVisibility> = {
      1: "showMonday",
      2: "showTuesday",
      3: "showWednesday",
      4: "showThursday",
      5: "showFriday",
      6: "showSaturday",
      7: "showSunday",
    };
    const key = weekdayMap[weekday];
    return key ? (visibility[key] as boolean) : false;
  }

  /**
   * Analyze workload for a date range.
   */
  analyzeWorkload(tasks: TaskItem<TFile>[], start: Moment, end: Moment): WorkloadAnalysis {
    const wipLimit = this.settings.dailyWipLimit;
    const isLimited = wipLimit > 0;
    const days: DayLoad[] = [];
    const workdays = this.getAvailableWorkdays(start, end);

    // Group tasks by date
    const tasksByDate = new Map<string, TaskItem<TFile>[]>();
    for (const task of tasks) {
      // Skip completed/canceled tasks
      if (task.status === TaskStatus.Complete || task.status === TaskStatus.Canceled) {
        continue;
      }
      const dueDate = findTaskDate(task, this.settings.dueDateAttribute);
      if (dueDate && dueDate.isSameOrAfter(start) && dueDate.isBefore(end)) {
        const dateStr = dueDate.format("YYYY-MM-DD");
        let dayTasks = tasksByDate.get(dateStr);
        if (!dayTasks) {
          dayTasks = [];
          tasksByDate.set(dateStr, dayTasks);
        }
        dayTasks.push(task);
      }
    }

    // Build day load info
    for (const workday of workdays) {
      const dateStr = workday.format("YYYY-MM-DD");
      const dayTasks = tasksByDate.get(dateStr) || [];
      const taskCount = dayTasks.length;
      const isOverloaded = isLimited && taskCount > wipLimit;
      const availableCapacity = isLimited ? Math.max(0, wipLimit - taskCount) : Infinity;

      days.push({
        date: workday,
        dateStr,
        tasks: dayTasks,
        taskCount,
        isWorkday: true,
        isOverloaded,
        availableCapacity,
      });
    }

    const hotspots = days.filter((d) => d.isOverloaded);
    const totalTasks = days.reduce((sum, d) => sum + d.taskCount, 0);
    const averageLoad = days.length > 0 ? totalTasks / days.length : 0;

    return {
      days,
      hotspots,
      totalTasks,
      averageLoad,
    };
  }

  /**
   * Plan how to spread tasks from an overloaded day.
   * Does not execute the moves, just calculates them.
   */
  planSpread(tasks: TaskItem<TFile>[], options: SpreadOptions): SpreadResult {
    const { sourceDate, targetRange, respectWipLimit = true, preserveCritical = true, maxLookAheadDays = 14 } = options;

    const wipLimit = this.settings.dailyWipLimit;
    const isLimited = wipLimit > 0 && respectWipLimit;

    // Determine the range to analyze
    const rangeStart = targetRange?.start || sourceDate.clone();
    const rangeEnd = targetRange?.end || sourceDate.clone().add(maxLookAheadDays, "days");

    // Get workload analysis
    const analysis = this.analyzeWorkload(tasks, rangeStart, rangeEnd);

    // Find the source day
    const sourceDateStr = sourceDate.format("YYYY-MM-DD");
    const sourceDay = analysis.days.find((d) => d.dateStr === sourceDateStr);

    if (!sourceDay || sourceDay.taskCount === 0) {
      return {
        moves: [],
        summary: { tasksSpread: 0, daysAffected: 0, tasksKept: 0 },
      };
    }

    // Separate tasks into moveable and non-moveable
    const moveableTasks: TaskItem<TFile>[] = [];
    const keptTasks: TaskItem<TFile>[] = [];

    for (const task of sourceDay.tasks as TaskItem<TFile>[]) {
      if (canTaskBeMoved(task, preserveCritical)) {
        moveableTasks.push(task);
      } else {
        keptTasks.push(task);
      }
    }

    // Sort moveable tasks by priority weight (highest weight = lowest priority = should move first)
    // So we sort descending by weight: lowest priority tasks come first
    moveableTasks.sort((a, b) => getSpreadWeight(b) - getSpreadWeight(a));

    // Calculate how many tasks need to move
    const targetCount = isLimited ? wipLimit : Math.ceil(sourceDay.taskCount / 2);
    const tasksToKeepCount = Math.max(targetCount - keptTasks.length, 0);
    // Take the first N tasks to move (lowest priority ones, which are at the start after sorting)
    const tasksToMove = moveableTasks.slice(0, moveableTasks.length - tasksToKeepCount);

    // Find available days for spreading (excluding source day)
    const availableDays = analysis.days.filter((d) => d.dateStr !== sourceDateStr && d.date.isAfter(sourceDate));

    // Track capacity as we assign tasks
    const dayCapacity = new Map<string, number>();
    for (const day of availableDays) {
      dayCapacity.set(day.dateStr, day.availableCapacity);
    }

    const moves: TaskMove[] = [];
    const affectedDays = new Set<string>();

    // Assign each task to the nearest available day within its spread limit
    for (const task of tasksToMove) {
      const maxDays = getSpreadWeight(task);
      const priority = getTaskPriority(task);

      // Find the nearest day with capacity within the task's spread limit
      let assigned = false;
      for (const day of availableDays) {
        const daysFromSource = day.date.diff(sourceDate, "days");
        if (daysFromSource > maxDays) {
          // Beyond this task's spread limit
          break;
        }

        const capacity = dayCapacity.get(day.dateStr) || 0;
        if (!isLimited || capacity > 0) {
          // Assign task to this day
          moves.push({
            task,
            fromDate: sourceDateStr,
            toDate: day.dateStr,
            priority,
          });
          dayCapacity.set(day.dateStr, capacity - 1);
          affectedDays.add(day.dateStr);
          assigned = true;
          break;
        }
      }

      // If we couldn't assign within the spread limit, try any available day
      if (!assigned) {
        for (const day of availableDays) {
          const capacity = dayCapacity.get(day.dateStr) || 0;
          if (!isLimited || capacity > 0) {
            moves.push({
              task,
              fromDate: sourceDateStr,
              toDate: day.dateStr,
              priority,
            });
            dayCapacity.set(day.dateStr, capacity - 1);
            affectedDays.add(day.dateStr);
            break;
          }
        }
      }
    }

    return {
      moves,
      summary: {
        tasksSpread: moves.length,
        daysAffected: affectedDays.size,
        tasksKept: keptTasks.length + tasksToKeepCount,
      },
    };
  }

  /**
   * Plan spreading for an entire week to balance workload.
   */
  planWeekBalance(tasks: TaskItem<TFile>[], weekStart: Moment): SpreadResult {
    const weekEnd = weekStart.clone().add(7, "days");
    const analysis = this.analyzeWorkload(tasks, weekStart, weekEnd);

    const allMoves: TaskMove[] = [];
    const affectedDays = new Set<string>();
    let totalKept = 0;

    // Process each hotspot
    for (const hotspot of analysis.hotspots) {
      const result = this.planSpread(tasks, {
        sourceDate: hotspot.date,
        targetRange: { start: weekStart, end: weekEnd },
        respectWipLimit: true,
        preserveCritical: true,
      });

      allMoves.push(...result.moves);
      result.moves.forEach((m) => affectedDays.add(m.toDate));
      totalKept += result.summary.tasksKept;
    }

    return {
      moves: allMoves,
      summary: {
        tasksSpread: allMoves.length,
        daysAffected: affectedDays.size,
        tasksKept: totalKept,
      },
    };
  }
}
