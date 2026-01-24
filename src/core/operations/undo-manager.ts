import { TaskPlannerEvent } from "../../events/task-planner-event";
import { TodoStatus } from "../../types/todo";

export interface TaskChange {
  todoId: string;
  filePath: string;
  lineNumber: number;
  attributeName: string;
  previousValue: string | boolean | undefined;
  newValue: string | boolean | undefined;
}

export interface StatusChange {
  todoId: string;
  filePath: string;
  lineNumber: number;
  previousStatus: TodoStatus;
  newStatus: TodoStatus;
  previousCompletedDate?: string;
  newCompletedDate?: string;
}

export interface TagChange {
  todoId: string;
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
  maxHistoryAgeMs: 300000, // 5 minutes
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
    this.redoStack = []; // Clear redo stack on new operation
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

  /**
   * Pops the last operation from history and moves it to redo stack.
   * Returns the operation that should be undone.
   * The caller is responsible for actually applying the undo.
   */
  popForUndo(): UndoOperation | null {
    if (!this.canUndo()) return null;

    const operation = this.history.pop()!;
    this.redoStack.push(operation);
    void this.onUndoPerformed.fire(operation);
    return operation;
  }

  /**
   * Pops the last operation from redo stack and moves it back to history.
   * Returns the operation that should be redone.
   * The caller is responsible for actually applying the redo.
   */
  popForRedo(): UndoOperation | null {
    if (!this.canRedo()) return null;

    const operation = this.redoStack.pop()!;
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

    // Remove operations older than maxAge
    this.history = this.history.filter((op) => now - op.timestamp < maxAge);

    // Keep only maxHistorySize most recent operations
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }

    // Also prune redo stack based on age
    this.redoStack = this.redoStack.filter((op) => now - op.timestamp < maxAge);
  }

  getHistorySize(): number {
    return this.history.length;
  }

  getRedoStackSize(): number {
    return this.redoStack.length;
  }

  /**
   * Generate a unique ID for an operation
   */
  static generateOperationId(): string {
    return `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a description for a move operation
   */
  static createMoveDescription(taskCount: number, destination: string): string {
    if (taskCount === 1) {
      return `Moved task to ${destination}`;
    }
    return `Moved ${taskCount} tasks to ${destination}`;
  }

  /**
   * Create a description for a status change operation
   */
  static createStatusDescription(taskCount: number, newStatus: TodoStatus): string {
    const statusName = TodoStatus[newStatus] || "Unknown";
    if (taskCount === 1) {
      return `Changed task to ${statusName}`;
    }
    return `Changed ${taskCount} tasks to ${statusName}`;
  }
}
