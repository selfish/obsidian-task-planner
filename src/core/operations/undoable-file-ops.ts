import { FileOperations } from "./file-operations";
import { UndoManager, UndoOperation, TaskChange, StatusChange, TagChange } from "./undo-manager";
import { TaskPlannerSettings } from "../../settings";
import { TaskItem, TaskStatus, getTaskId } from "../../types";
import { moment } from "../../utils";

export interface UndoableFileOperationsDeps {
  settings: TaskPlannerSettings;
  undoManager: UndoManager;
}

export class UndoableFileOperations {
  private fileOperations: FileOperations;
  private undoManager: UndoManager;
  private settings: TaskPlannerSettings;

  constructor(deps: UndoableFileOperationsDeps) {
    this.settings = deps.settings;
    this.undoManager = deps.undoManager;
    this.fileOperations = new FileOperations(deps.settings);
  }

  private createOperation(type: "single" | "batch", description: string, taskChanges: TaskChange[] = [], statusChanges: StatusChange[] = [], tagChanges: TagChange[] = []): UndoOperation {
    return {
      id: UndoManager.generateOperationId(),
      timestamp: Date.now(),
      type,
      description,
      taskChanges,
      statusChanges,
      tagChanges,
    };
  }

  private isCompleted(status: TaskStatus): boolean {
    return status === TaskStatus.Complete || status === TaskStatus.Canceled;
  }

  async updateAttributeWithUndo<T>(task: TaskItem<T>, attributeName: string, attributeValue: string | boolean | undefined, description: string): Promise<void> {
    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.updateAttribute(task, attributeName, attributeValue);
      return;
    }

    const previousValue = task.attributes?.[attributeName];
    await this.fileOperations.updateAttribute(task, attributeName, attributeValue);

    const taskChange: TaskChange = {
      taskId: getTaskId(task),
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      attributeName,
      previousValue,
      newValue: attributeValue,
    };

    this.undoManager.recordOperation(this.createOperation("single", description, [taskChange]));
  }

  async removeAttributeWithUndo<T>(task: TaskItem<T>, attributeName: string, description: string): Promise<void> {
    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.removeAttribute(task, attributeName);
      return;
    }

    const previousValue = task.attributes?.[attributeName];
    await this.fileOperations.removeAttribute(task, attributeName);

    const taskChange: TaskChange = {
      taskId: getTaskId(task),
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      attributeName,
      previousValue,
      newValue: undefined,
    };

    this.undoManager.recordOperation(this.createOperation("single", description, [taskChange]));
  }

  async updateTaskStatusWithUndo<T>(task: TaskItem<T>, previousStatus: TaskStatus, description: string): Promise<void> {
    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.updateTaskStatus(task, this.settings.completedDateAttribute);
      return;
    }

    const wasCompleted = this.isCompleted(previousStatus);
    const previousCompletedDate = wasCompleted ? (task.attributes?.[this.settings.completedDateAttribute] as string | undefined) : undefined;
    const newCompletedDate = this.isCompleted(task.status) ? moment().format("YYYY-MM-DD") : undefined;

    await this.fileOperations.updateTaskStatus(task, this.settings.completedDateAttribute);

    const statusChange: StatusChange = {
      taskId: getTaskId(task),
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      previousStatus,
      newStatus: task.status,
      previousCompletedDate,
      newCompletedDate,
    };

    this.undoManager.recordOperation(this.createOperation("single", description, [], [statusChange]));
  }

  async appendTagWithUndo<T>(task: TaskItem<T>, tag: string, description: string): Promise<void> {
    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.appendTag(task, tag);
      return;
    }

    if (task.tags?.includes(tag)) {
      return;
    }

    await this.fileOperations.appendTag(task, tag);

    const tagChange: TagChange = {
      taskId: getTaskId(task),
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      tag,
      action: "added",
    };

    this.undoManager.recordOperation(this.createOperation("single", description, [], [], [tagChange]));
  }

  async batchUpdateAttributeWithUndo<T>(tasks: TaskItem<T>[], attributeName: string, attributeValue: string | boolean | undefined, description: string): Promise<void> {
    if (tasks.length === 0) return;

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchUpdateAttribute(tasks, attributeName, attributeValue);
      return;
    }

    const taskChanges: TaskChange[] = tasks.map((task) => ({
      taskId: getTaskId(task),
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      attributeName,
      previousValue: task.attributes?.[attributeName],
      newValue: attributeValue,
    }));

    await this.fileOperations.batchUpdateAttribute(tasks, attributeName, attributeValue);
    this.undoManager.recordOperation(this.createOperation("batch", description, taskChanges));
  }

  async batchRemoveAttributeWithUndo<T>(tasks: TaskItem<T>[], attributeName: string, description: string): Promise<void> {
    if (tasks.length === 0) return;

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchRemoveAttribute(tasks, attributeName);
      return;
    }

    const taskChanges: TaskChange[] = tasks.map((task) => ({
      taskId: getTaskId(task),
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      attributeName,
      previousValue: task.attributes?.[attributeName],
      newValue: undefined,
    }));

    await this.fileOperations.batchRemoveAttribute(tasks, attributeName);
    this.undoManager.recordOperation(this.createOperation("batch", description, taskChanges));
  }

  async batchUpdateTaskStatusWithUndo<T>(tasks: TaskItem<T>[], previousStatuses: Map<string, TaskStatus>, description: string): Promise<void> {
    if (tasks.length === 0) return;

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchUpdateTaskStatus(tasks, this.settings.completedDateAttribute);
      return;
    }

    const statusChanges: StatusChange[] = tasks.map((task) => {
      const taskId = getTaskId(task);
      const previousStatus = previousStatuses.get(taskId) ?? task.status;
      const wasCompleted = this.isCompleted(previousStatus);
      const previousCompletedDate = wasCompleted ? (task.attributes?.[this.settings.completedDateAttribute] as string | undefined) : undefined;
      const newCompletedDate = this.isCompleted(task.status) ? moment().format("YYYY-MM-DD") : undefined;

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
    this.undoManager.recordOperation(this.createOperation("batch", description, [], statusChanges));
  }

  async batchAppendTagWithUndo<T>(tasks: TaskItem<T>[], tag: string, description: string): Promise<void> {
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
    this.undoManager.recordOperation(this.createOperation("batch", description, [], [], tagChanges));
  }

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
      for (const task of tasks.filter((t) => !t.tags?.includes(tag))) {
        tagChanges.push({
          taskId: getTaskId(task),
          filePath: task.file.path,
          lineNumber: task.line ?? 0,
          tag,
          action: "added",
        });
      }
    }

    if (tagsToRemove && tagsToRemove.length > 0) {
      for (const tagToRemove of tagsToRemove) {
        for (const task of tasks.filter((t) => t.tags?.includes(tagToRemove))) {
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
        const previousStatus = task.status;
        const wasCompleted = this.isCompleted(previousStatus);
        const previousCompletedDate = wasCompleted ? (task.attributes?.[this.settings.completedDateAttribute] as string | undefined) : undefined;
        const newCompletedDate = this.isCompleted(newStatus) ? moment().format("YYYY-MM-DD") : undefined;

        statusChanges.push({
          taskId: getTaskId(task),
          filePath: task.file.path,
          lineNumber: task.line ?? 0,
          previousStatus,
          newStatus,
          previousCompletedDate,
          newCompletedDate,
        });
      }
    }

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

    this.undoManager.recordOperation(this.createOperation(tasks.length > 1 ? "batch" : "single", effectiveDescription, taskChanges, statusChanges, tagChanges));
  }

  async applyUndo<T>(operation: UndoOperation, findTask: (taskId: string) => TaskItem<T> | undefined): Promise<boolean> {
    let success = true;

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

    for (const change of operation.tagChanges) {
      const task = findTask(change.taskId);
      if (task) {
        try {
          if (change.action === "added") {
            await this.fileOperations.removeTag(task, change.tag);
          } else {
            await this.fileOperations.appendTag(task, change.tag);
          }
        } catch {
          success = false;
        }
      } else {
        success = false;
      }
    }

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

  async applyRedo<T>(operation: UndoOperation, findTask: (taskId: string) => TaskItem<T> | undefined): Promise<boolean> {
    let success = true;

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

    for (const change of operation.tagChanges) {
      const task = findTask(change.taskId);
      if (task) {
        try {
          if (change.action === "added") {
            await this.fileOperations.appendTag(task, change.tag);
          } else {
            await this.fileOperations.removeTag(task, change.tag);
          }
        } catch {
          success = false;
        }
      } else {
        success = false;
      }
    }

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
