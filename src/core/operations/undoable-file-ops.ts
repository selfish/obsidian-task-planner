import { FileOperations } from "./file-operations";
import { UndoManager, UndoOperation, TaskChange, StatusChange, TagChange } from "./undo-manager";
import { TaskPlannerSettings } from "../../settings";
import { TaskItem, TaskStatus, getTaskId } from "../../types";
import { moment } from "../../utils";

export interface UndoableFileOperationsDeps {
  settings: TaskPlannerSettings;
  undoManager: UndoManager;
}

/**
 * A wrapper around FileOperations that records undo information.
 * Use this for drag-and-drop operations where undo support is desired.
 */
export class UndoableFileOperations {
  private fileOperations: FileOperations;
  private undoManager: UndoManager;
  private settings: TaskPlannerSettings;

  constructor(deps: UndoableFileOperationsDeps) {
    this.settings = deps.settings;
    this.undoManager = deps.undoManager;
    this.fileOperations = new FileOperations(deps.settings);
  }

  /**
   * Update attribute with undo tracking
   */
  async updateAttributeWithUndo<T>(task: TaskItem<T>, attributeName: string, attributeValue: string | boolean | undefined, description: string): Promise<void> {
    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.updateAttribute(task, attributeName, attributeValue);
      return;
    }

    const previousValue = task.attributes?.[attributeName];
    const taskId = getTaskId(task);

    await this.fileOperations.updateAttribute(task, attributeName, attributeValue);

    const taskChange: TaskChange = {
      taskId,
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      attributeName,
      previousValue,
      newValue: attributeValue,
    };

    const operation: UndoOperation = {
      id: UndoManager.generateOperationId(),
      timestamp: Date.now(),
      type: "single",
      description,
      taskChanges: [taskChange],
      statusChanges: [],
      tagChanges: [],
    };

    this.undoManager.recordOperation(operation);
  }

  /**
   * Remove attribute with undo tracking
   */
  async removeAttributeWithUndo<T>(task: TaskItem<T>, attributeName: string, description: string): Promise<void> {
    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.removeAttribute(task, attributeName);
      return;
    }

    const previousValue = task.attributes?.[attributeName];
    const taskId = getTaskId(task);

    await this.fileOperations.removeAttribute(task, attributeName);

    const taskChange: TaskChange = {
      taskId,
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      attributeName,
      previousValue,
      newValue: undefined,
    };

    const operation: UndoOperation = {
      id: UndoManager.generateOperationId(),
      timestamp: Date.now(),
      type: "single",
      description,
      taskChanges: [taskChange],
      statusChanges: [],
      tagChanges: [],
    };

    this.undoManager.recordOperation(operation);
  }

  /**
   * Update task status with undo tracking
   */
  async updateTaskStatusWithUndo<T>(task: TaskItem<T>, previousStatus: TaskStatus, description: string): Promise<void> {
    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.updateTaskStatus(task, this.settings.completedDateAttribute);
      return;
    }

    const taskId = getTaskId(task);
    const isCompleted = task.status === TaskStatus.Complete || task.status === TaskStatus.Canceled;
    const wasCompleted = previousStatus === TaskStatus.Complete || previousStatus === TaskStatus.Canceled;
    const previousCompletedDate = wasCompleted ? (task.attributes?.[this.settings.completedDateAttribute] as string | undefined) : undefined;
    const newCompletedDate = isCompleted ? moment().format("YYYY-MM-DD") : undefined;

    await this.fileOperations.updateTaskStatus(task, this.settings.completedDateAttribute);

    const statusChange: StatusChange = {
      taskId,
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      previousStatus,
      newStatus: task.status,
      previousCompletedDate,
      newCompletedDate,
    };

    const operation: UndoOperation = {
      id: UndoManager.generateOperationId(),
      timestamp: Date.now(),
      type: "single",
      description,
      taskChanges: [],
      statusChanges: [statusChange],
      tagChanges: [],
    };

    this.undoManager.recordOperation(operation);
  }

  /**
   * Append tag with undo tracking
   */
  async appendTagWithUndo<T>(task: TaskItem<T>, tag: string, description: string): Promise<void> {
    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.appendTag(task, tag);
      return;
    }

    // Check if tag already exists - if so, skip
    if (task.tags?.includes(tag)) {
      return;
    }

    const taskId = getTaskId(task);

    await this.fileOperations.appendTag(task, tag);

    const tagChange: TagChange = {
      taskId,
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      tag,
      action: "added",
    };

    const operation: UndoOperation = {
      id: UndoManager.generateOperationId(),
      timestamp: Date.now(),
      type: "single",
      description,
      taskChanges: [],
      statusChanges: [],
      tagChanges: [tagChange],
    };

    this.undoManager.recordOperation(operation);
  }

  /**
   * Batch update attribute with undo tracking for multiple tasks
   */
  async batchUpdateAttributeWithUndo<T>(tasks: TaskItem<T>[], attributeName: string, attributeValue: string | boolean | undefined, description: string): Promise<void> {
    if (tasks.length === 0) return;

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchUpdateAttribute(tasks, attributeName, attributeValue);
      return;
    }

    // Capture previous values before the update
    const taskChanges: TaskChange[] = tasks.map((task) => ({
      taskId: getTaskId(task),
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      attributeName,
      previousValue: task.attributes?.[attributeName],
      newValue: attributeValue,
    }));

    await this.fileOperations.batchUpdateAttribute(tasks, attributeName, attributeValue);

    const operation: UndoOperation = {
      id: UndoManager.generateOperationId(),
      timestamp: Date.now(),
      type: "batch",
      description,
      taskChanges,
      statusChanges: [],
      tagChanges: [],
    };

    this.undoManager.recordOperation(operation);
  }

  /**
   * Batch remove attribute with undo tracking
   */
  async batchRemoveAttributeWithUndo<T>(tasks: TaskItem<T>[], attributeName: string, description: string): Promise<void> {
    if (tasks.length === 0) return;

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchRemoveAttribute(tasks, attributeName);
      return;
    }

    // Capture previous values
    const taskChanges: TaskChange[] = tasks.map((task) => ({
      taskId: getTaskId(task),
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      attributeName,
      previousValue: task.attributes?.[attributeName],
      newValue: undefined,
    }));

    await this.fileOperations.batchRemoveAttribute(tasks, attributeName);

    const operation: UndoOperation = {
      id: UndoManager.generateOperationId(),
      timestamp: Date.now(),
      type: "batch",
      description,
      taskChanges,
      statusChanges: [],
      tagChanges: [],
    };

    this.undoManager.recordOperation(operation);
  }

  /**
   * Batch update task status with undo tracking
   */
  async batchUpdateTaskStatusWithUndo<T>(tasks: TaskItem<T>[], previousStatuses: Map<string, TaskStatus>, description: string): Promise<void> {
    if (tasks.length === 0) return;

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchUpdateTaskStatus(tasks, this.settings.completedDateAttribute);
      return;
    }

    const statusChanges: StatusChange[] = tasks.map((task) => {
      const taskId = getTaskId(task);
      const previousStatus = previousStatuses.get(taskId) ?? task.status;
      const isCompleted = task.status === TaskStatus.Complete || task.status === TaskStatus.Canceled;
      const wasCompleted = previousStatus === TaskStatus.Complete || previousStatus === TaskStatus.Canceled;
      const previousCompletedDate = wasCompleted ? (task.attributes?.[this.settings.completedDateAttribute] as string | undefined) : undefined;
      const newCompletedDate = isCompleted ? moment().format("YYYY-MM-DD") : undefined;

      return {
        taskId,
        filePath: task.file.path,
        lineNumber: task.line ?? 0,
        previousStatus,
        newStatus: task.status,
        previousCompletedDate,
        newCompletedDate,
      };
    });

    await this.fileOperations.batchUpdateTaskStatus(tasks, this.settings.completedDateAttribute);

    const operation: UndoOperation = {
      id: UndoManager.generateOperationId(),
      timestamp: Date.now(),
      type: "batch",
      description,
      taskChanges: [],
      statusChanges,
      tagChanges: [],
    };

    this.undoManager.recordOperation(operation);
  }

  /**
   * Batch append tag with undo tracking
   */
  async batchAppendTagWithUndo<T>(tasks: TaskItem<T>[], tag: string, description: string): Promise<void> {
    // Filter out tasks that already have the tag
    const tasksNeedingTag = tasks.filter((t) => !t.tags?.includes(tag));
    if (tasksNeedingTag.length === 0) return;

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchAppendTag(tasks, tag);
      return;
    }

    const tagChanges: TagChange[] = tasksNeedingTag.map((task) => ({
      taskId: getTaskId(task),
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      tag,
      action: "added" as const,
    }));

    await this.fileOperations.batchAppendTag(tasks, tag);

    const operation: UndoOperation = {
      id: UndoManager.generateOperationId(),
      timestamp: Date.now(),
      type: "batch",
      description,
      taskChanges: [],
      statusChanges: [],
      tagChanges,
    };

    this.undoManager.recordOperation(operation);
  }

  /**
   * Combined operation: update attribute, append tag, remove tags, and update status
   * This is commonly used for drag-and-drop operations
   */
  async combinedMoveWithUndo<T>(tasks: TaskItem<T>[], attributeName: string, attributeValue: string | boolean | undefined, tag?: string, newStatus?: TaskStatus, description?: string, tagsToRemove?: string[]): Promise<void> {
    if (tasks.length === 0) return;

    const effectiveDescription = description ?? UndoManager.createMoveDescription(tasks.length, String(attributeValue));

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchUpdateAttribute(tasks, attributeName, attributeValue);
      if (tag) {
        await this.fileOperations.batchAppendTag(tasks, tag);
      }
      if (tagsToRemove && tagsToRemove.length > 0) {
        for (const tagToRemove of tagsToRemove) {
          await this.fileOperations.batchRemoveTag(tasks, tagToRemove);
        }
      }
      if (newStatus !== undefined) {
        tasks.forEach((t) => (t.status = newStatus));
        await this.fileOperations.batchUpdateTaskStatus(tasks, this.settings.completedDateAttribute);
      }
      return;
    }

    // Capture all pre-operation state
    const taskChanges: TaskChange[] = tasks.map((task) => ({
      taskId: getTaskId(task),
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      attributeName,
      previousValue: task.attributes?.[attributeName],
      newValue: attributeValue,
    }));

    const tagChanges: TagChange[] = [];
    if (tag) {
      const tasksNeedingTag = tasks.filter((t) => !t.tags?.includes(tag));
      for (const task of tasksNeedingTag) {
        tagChanges.push({
          taskId: getTaskId(task),
          filePath: task.file.path,
          lineNumber: task.line ?? 0,
          tag,
          action: "added",
        });
      }
    }

    // Record tag removals
    if (tagsToRemove && tagsToRemove.length > 0) {
      for (const tagToRemove of tagsToRemove) {
        const tasksWithTag = tasks.filter((t) => t.tags?.includes(tagToRemove));
        for (const task of tasksWithTag) {
          tagChanges.push({
            taskId: getTaskId(task),
            filePath: task.file.path,
            lineNumber: task.line ?? 0,
            tag: tagToRemove,
            action: "removed",
          });
        }
      }
    }

    const statusChanges: StatusChange[] = [];
    if (newStatus !== undefined) {
      for (const task of tasks) {
        const taskId = getTaskId(task);
        const previousStatus = task.status;
        const isCompleted = newStatus === TaskStatus.Complete || newStatus === TaskStatus.Canceled;
        const wasCompleted = previousStatus === TaskStatus.Complete || previousStatus === TaskStatus.Canceled;
        const previousCompletedDate = wasCompleted ? (task.attributes?.[this.settings.completedDateAttribute] as string | undefined) : undefined;
        const newCompletedDate = isCompleted ? moment().format("YYYY-MM-DD") : undefined;

        statusChanges.push({
          taskId,
          filePath: task.file.path,
          lineNumber: task.line ?? 0,
          previousStatus,
          newStatus,
          previousCompletedDate,
          newCompletedDate,
        });
      }
    }

    // Perform the actual operations
    await this.fileOperations.batchUpdateAttribute(tasks, attributeName, attributeValue);
    if (tag) {
      await this.fileOperations.batchAppendTag(tasks, tag);
    }
    if (tagsToRemove && tagsToRemove.length > 0) {
      for (const tagToRemove of tagsToRemove) {
        await this.fileOperations.batchRemoveTag(tasks, tagToRemove);
      }
    }
    if (newStatus !== undefined) {
      tasks.forEach((t) => (t.status = newStatus));
      await this.fileOperations.batchUpdateTaskStatus(tasks, this.settings.completedDateAttribute);
    }

    // Record combined operation
    const operation: UndoOperation = {
      id: UndoManager.generateOperationId(),
      timestamp: Date.now(),
      type: tasks.length > 1 ? "batch" : "single",
      description: effectiveDescription,
      taskChanges,
      statusChanges,
      tagChanges,
    };

    this.undoManager.recordOperation(operation);
  }

  /**
   * Apply an undo operation - restores previous values
   */
  async applyUndo<T>(operation: UndoOperation, findTask: (taskId: string) => TaskItem<T> | undefined): Promise<boolean> {
    let success = true;

    // Restore task attribute changes
    for (const change of operation.taskChanges) {
      const task = findTask(change.taskId);
      if (task) {
        try {
          if (change.previousValue === undefined || change.previousValue === false) {
            await this.fileOperations.removeAttribute(task, change.attributeName);
          } else {
            await this.fileOperations.updateAttribute(task, change.attributeName, change.previousValue);
          }
        } catch {
          success = false;
        }
      } else {
        success = false;
      }
    }

    // Restore tag changes
    for (const change of operation.tagChanges) {
      const task = findTask(change.taskId);
      if (task) {
        try {
          if (change.action === "added") {
            // Tag was added, so remove it
            await this.fileOperations.removeTag(task, change.tag);
          } else {
            // Tag was removed, so add it back
            await this.fileOperations.appendTag(task, change.tag);
          }
        } catch {
          success = false;
        }
      } else {
        success = false;
      }
    }

    // Restore status changes
    for (const change of operation.statusChanges) {
      const task = findTask(change.taskId);
      if (task) {
        try {
          task.status = change.previousStatus;
          await this.fileOperations.updateTaskStatus(task, this.settings.completedDateAttribute);
        } catch {
          success = false;
        }
      } else {
        success = false;
      }
    }

    return success;
  }

  /**
   * Apply a redo operation - restores new values
   */
  async applyRedo<T>(operation: UndoOperation, findTask: (taskId: string) => TaskItem<T> | undefined): Promise<boolean> {
    let success = true;

    // Reapply task attribute changes
    for (const change of operation.taskChanges) {
      const task = findTask(change.taskId);
      if (task) {
        try {
          if (change.newValue === undefined || change.newValue === false) {
            await this.fileOperations.removeAttribute(task, change.attributeName);
          } else {
            await this.fileOperations.updateAttribute(task, change.attributeName, change.newValue);
          }
        } catch {
          success = false;
        }
      } else {
        success = false;
      }
    }

    // Reapply tag changes
    for (const change of operation.tagChanges) {
      const task = findTask(change.taskId);
      if (task) {
        try {
          if (change.action === "added") {
            // Tag was added, so add it again
            await this.fileOperations.appendTag(task, change.tag);
          } else {
            // Tag was removed, so remove it again
            await this.fileOperations.removeTag(task, change.tag);
          }
        } catch {
          success = false;
        }
      } else {
        success = false;
      }
    }

    // Reapply status changes
    for (const change of operation.statusChanges) {
      const task = findTask(change.taskId);
      if (task) {
        try {
          task.status = change.newStatus;
          await this.fileOperations.updateTaskStatus(task, this.settings.completedDateAttribute);
        } catch {
          success = false;
        }
      } else {
        success = false;
      }
    }

    return success;
  }
}
