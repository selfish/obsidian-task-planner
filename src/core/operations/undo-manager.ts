import { TaskPlannerEvent } from "../../events/task-planner-event";
import { TaskStatus } from "../../types/task";

export interface TaskChange {
  taskId: string;
  filePath: string;
  lineNumber: number;
  attributeName: string;
  previousValue: string | boolean | undefined;
  newValue: string | boolean | undefined;
}

export interface StatusChange {
  taskId: string;
  filePath: string;
  lineNumber: number;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  previousCompletedDate?: string;
  newCompletedDate?: string;
}

export interface TagChange {
  taskId: string;
  filePath: string;
  lineNumber: number;
  tag: string;
  action: "added" | "removed";
}

export interface UndoOperation {
  id: string;
  timestamp: number;
  type: "single" | "batch";
  description: string;
  taskChanges: TaskChange[];
  statusChanges: StatusChange[];
  tagChanges: TagChange[];
}

export interface UndoManagerConfig {
  maxHistorySize: number;
  maxHistoryAgeMs: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: UndoManagerConfig = {
  maxHistorySize: 10,
  maxHistoryAgeMs: 300000,
  enabled: true,
};

export class UndoManager {
  private history: UndoOperation[] = [];
  private redoStack: UndoOperation[] = [];
  private config: UndoManagerConfig;

  readonly onOperationRecorded = new TaskPlannerEvent<UndoOperation>();
  readonly onUndoPerformed = new TaskPlannerEvent<UndoOperation>();
  readonly onRedoPerformed = new TaskPlannerEvent<UndoOperation>();

  constructor(config?: Partial<UndoManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  updateConfig(config: Partial<UndoManagerConfig>): void {
    this.config = { ...this.config, ...config };
    this.pruneOldOperations();
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  recordOperation(operation: UndoOperation): void {
    if (!this.config.enabled) return;

    this.history.push(operation);
    this.redoStack = [];
    this.pruneOldOperations();
    void this.onOperationRecorded.fire(operation);
  }

  canUndo(): boolean {
    this.pruneOldOperations();
    return this.config.enabled && this.history.length > 0;
  }

  canRedo(): boolean {
    return this.config.enabled && this.redoStack.length > 0;
  }

  getLastOperation(): UndoOperation | null {
    this.pruneOldOperations();
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  popForUndo(): UndoOperation | null {
    if (!this.canUndo()) return null;

    const operation = this.history.pop();
    this.redoStack.push(operation);
    void this.onUndoPerformed.fire(operation);
    return operation;
  }

  popForRedo(): UndoOperation | null {
    if (!this.canRedo()) return null;

    const operation = this.redoStack.pop();
    this.history.push(operation);
    void this.onRedoPerformed.fire(operation);
    return operation;
  }

  clearHistory(): void {
    this.history = [];
    this.redoStack = [];
  }

  pruneOldOperations(): void {
    const now = Date.now();
    const maxAge = this.config.maxHistoryAgeMs;

    this.history = this.history.filter((op) => now - op.timestamp < maxAge);

    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }

    this.redoStack = this.redoStack.filter((op) => now - op.timestamp < maxAge);
  }

  getHistorySize(): number {
    return this.history.length;
  }

  getRedoStackSize(): number {
    return this.redoStack.length;
  }

  static generateOperationId(): string {
    return `undo-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  static createMoveDescription(taskCount: number, destination: string): string {
    if (taskCount === 1) {
      return `Moved task to ${destination}`;
    }
    return `Moved ${taskCount} tasks to ${destination}`;
  }

  static createStatusDescription(taskCount: number, newStatus: TaskStatus): string {
    const statusName = TaskStatus[newStatus] || "Unknown";
    if (taskCount === 1) {
      return `Changed task to ${statusName}`;
    }
    return `Changed ${taskCount} tasks to ${statusName}`;
  }
}
