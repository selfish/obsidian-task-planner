import { FileOperations, TaskMutation } from "./file-operations";
import { UndoManager, UndoOperation, TaskChange, StatusChange, TagChange } from "./undo-manager";
import { TaskPlannerSettings } from "../../settings";
import { TaskItem, TaskStatus, getTaskId } from "../../types";
import { moment } from "../../utils";

export interface UndoableFileOperationsDeps {
  settings: TaskPlannerSettings;
  undoManager: UndoManager;
}

type RecordedChange = TaskChange | StatusChange | TagChange;
type SourceIdentity = Pick<TaskItem<unknown>, "sourceLine" | "sourceLineCount">;

/**
 * A wrapper around FileOperations that records undo information.
 * Use this for drag-and-drop operations where undo support is desired.
 */
export class UndoableFileOperations {
  private fileOperations: FileOperations;
  private undoManager: UndoManager;
  private settings: TaskPlannerSettings;
  private pendingOperation: Promise<unknown> = Promise.resolve();

  constructor(deps: UndoableFileOperationsDeps) {
    this.settings = deps.settings;
    this.undoManager = deps.undoManager;
    this.fileOperations = new FileOperations(deps.settings);
  }

  private updateChangeIdentity<T>(change: RecordedChange, task: TaskItem<T>): void {
    change.taskId = getTaskId(task);
    change.filePath = task.file.path;
    change.lineNumber = task.line ?? 0;
    change.sourceLine = task.sourceLine;
  }

  private async resolveOperationTasks<T>(operation: UndoOperation, findTask: (taskId: string, filePath?: string, sourceLine?: string) => TaskItem<T> | undefined): Promise<{ resolved: Map<RecordedChange, TaskItem<T>>; originals: Map<TaskItem<T>, SourceIdentity> }> {
    const resolved = new Map<RecordedChange, TaskItem<T>>();
    const originals = new Map<TaskItem<T>, SourceIdentity>();
    const tasksById = new Map<string, TaskItem<T> | undefined>();
    for (const change of [...operation.taskChanges, ...operation.tagChanges, ...operation.statusChanges]) {
      if (!tasksById.has(change.taskId)) tasksById.set(change.taskId, findTask(change.taskId, change.filePath, change.sourceLine));
      const task = tasksById.get(change.taskId);
      if (!task) continue;
      if (getTaskId(task) !== change.taskId && (change.sourceLine !== undefined || task.sourceLine !== undefined)) continue;
      if (change.sourceLine !== undefined && task.sourceLine !== undefined && task.sourceLine !== change.sourceLine) {
        if (!(await this.fileOperations.hasSourceLineAt(task, change.lineNumber, change.sourceLine))) continue;
      }
      if (!originals.has(task)) originals.set(task, { sourceLine: task.sourceLine, sourceLineCount: task.sourceLineCount });
      if (change.sourceLine !== undefined) task.sourceLine = change.sourceLine;
      resolved.set(change, task);
    }
    return { resolved, originals };
  }

  private restoreUnappliedIdentity<T>(task: TaskItem<T>, originals: Map<TaskItem<T>, SourceIdentity>, applied: Set<TaskItem<T>>): void {
    if (!applied.has(task)) Object.assign(task, originals.get(task));
  }

  private async applyChange<T>(task: TaskItem<T> | undefined, update: (task: TaskItem<T>) => Promise<void>, originals: Map<TaskItem<T>, SourceIdentity>, applied: Set<TaskItem<T>>, failed: Set<TaskItem<T>>): Promise<boolean> {
    if (!task || failed.has(task)) return false;
    const status = task.status;
    try {
      await update(task);
      applied.add(task);
      return true;
    } catch {
      task.status = status;
      this.restoreUnappliedIdentity(task, originals, applied);
      failed.add(task);
      return false;
    }
  }

  private serializeOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pendingOperation.then(operation, operation);
    this.pendingOperation = result.catch(() => undefined);
    return result;
  }

  private hasConcreteTag<T>(task: TaskItem<T>, tag: string): boolean {
    return task.sourceLine ? this.fileOperations.lineParser.hasTag(task.sourceLine, tag) : (task.tags?.includes(tag) ?? false);
  }

  private updateOperationIdentities<T>(resolved: Map<RecordedChange, TaskItem<T>>, applied: Set<TaskItem<T>>): void {
    for (const [change, task] of resolved) if (applied.has(task)) this.updateChangeIdentity(change, task);
  }

  /**
   * Update attribute with undo tracking
   */
  async updateAttributeWithUndo<T>(task: TaskItem<T>, attributeName: string, attributeValue: string | boolean | undefined, description: string): Promise<void> {
    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.updateAttribute(task, attributeName, attributeValue);
      return;
    }

    await this.fileOperations.refreshTasks([task]);
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
    this.updateChangeIdentity(taskChange, task);

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

    await this.fileOperations.refreshTasks([task]);
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
    this.updateChangeIdentity(taskChange, task);

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

    await this.fileOperations.refreshTasks([task]);
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
    this.updateChangeIdentity(statusChange, task);

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

    await this.fileOperations.refreshTasks([task]);
    // Check if tag already exists - if so, skip
    if (this.hasConcreteTag(task, tag)) {
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
    this.updateChangeIdentity(tagChange, task);

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

    await this.fileOperations.refreshTasks(tasks);
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
    taskChanges.forEach((change, index) => this.updateChangeIdentity(change, tasks[index]));

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
  batchRemoveAttributeWithUndo<T>(tasks: TaskItem<T>[], attributeName: string, description: string): Promise<void> {
    return this.serializeOperation(() => this.batchRemoveAttributeWithUndoNow(tasks, attributeName, description));
  }

  private async batchRemoveAttributeWithUndoNow<T>(tasks: TaskItem<T>[], attributeName: string, description: string): Promise<void> {
    if (tasks.length === 0) return;

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchRemoveAttribute(tasks, attributeName);
      return;
    }

    await this.fileOperations.refreshTasks(tasks);
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
    taskChanges.forEach((change, index) => this.updateChangeIdentity(change, tasks[index]));

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
  batchUpdateTaskStatusWithUndo<T>(tasks: TaskItem<T>[], newStatus: TaskStatus, description: string): Promise<void> {
    return this.serializeOperation(() => this.batchUpdateTaskStatusWithUndoNow(tasks, newStatus, description));
  }

  private async batchUpdateTaskStatusWithUndoNow<T>(tasks: TaskItem<T>[], newStatus: TaskStatus, description: string): Promise<void> {
    if (tasks.length === 0) return;

    await this.fileOperations.refreshTasks(tasks);
    const statusChanges: StatusChange[] = tasks.map((task) => {
      const previousStatus = task.status;
      const isCompleted = newStatus === TaskStatus.Complete || newStatus === TaskStatus.Canceled;
      const wasCompleted = previousStatus === TaskStatus.Complete || previousStatus === TaskStatus.Canceled;
      const previousCompletedDate = wasCompleted ? (task.attributes?.[this.settings.completedDateAttribute] as string | undefined) : undefined;
      const newCompletedDate = isCompleted ? moment().format("YYYY-MM-DD") : undefined;

      return {
        taskId: getTaskId(task),
        filePath: task.file.path,
        lineNumber: task.line ?? 0,
        previousStatus,
        newStatus,
        previousCompletedDate,
        newCompletedDate,
      };
    });

    tasks.forEach((task) => (task.status = newStatus));
    try {
      await this.fileOperations.batchUpdateTaskStatus(tasks, this.settings.completedDateAttribute);
    } catch (error) {
      tasks.forEach((task, index) => (task.status = statusChanges[index].previousStatus));
      throw error;
    }
    if (!this.undoManager.isEnabled()) return;
    statusChanges.forEach((change, index) => this.updateChangeIdentity(change, tasks[index]));

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
    if (tasks.length === 0) return;

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchAppendTag(tasks, tag);
      return;
    }

    await this.fileOperations.refreshTasks(tasks);
    const tasksNeedingTag = tasks.filter((task) => !this.hasConcreteTag(task, tag));
    if (tasksNeedingTag.length === 0) return;

    const tagChanges: TagChange[] = tasksNeedingTag.map((task) => ({
      taskId: getTaskId(task),
      filePath: task.file.path,
      lineNumber: task.line ?? 0,
      tag,
      action: "added" as const,
    }));

    await this.fileOperations.batchAppendTag(tasks, tag);
    tagChanges.forEach((change, index) => this.updateChangeIdentity(change, tasksNeedingTag[index]));

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
  combinedMoveWithUndo<T>(tasks: TaskItem<T>[], attributeName: string, attributeValue: string | boolean | undefined, tag?: string, newStatus?: TaskStatus, description?: string, tagsToRemove?: string[]): Promise<void> {
    return this.serializeOperation(() => this.combinedMoveWithUndoNow(tasks, attributeName, attributeValue, tag, newStatus, description, tagsToRemove));
  }

  private async combinedMoveWithUndoNow<T>(tasks: TaskItem<T>[], attributeName: string, attributeValue: string | boolean | undefined, tag?: string, newStatus?: TaskStatus, description?: string, tagsToRemove?: string[]): Promise<void> {
    if (tasks.length === 0) return;

    const effectiveDescription = description ?? UndoManager.createMoveDescription(tasks.length, String(attributeValue));

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchMove(tasks, attributeName, attributeValue, this.settings.completedDateAttribute, tag, newStatus, tagsToRemove);
      return;
    }

    await this.fileOperations.refreshTasks(tasks);

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
    const tagChangeTasks: TaskItem<T>[] = [];
    if (tag) {
      const tasksNeedingTag = tasks.filter((task) => !this.hasConcreteTag(task, tag));
      for (const task of tasksNeedingTag) {
        tagChanges.push({
          taskId: getTaskId(task),
          filePath: task.file.path,
          lineNumber: task.line ?? 0,
          tag,
          action: "added",
        });
        tagChangeTasks.push(task);
      }
    }

    // Record tag removals
    if (tagsToRemove && tagsToRemove.length > 0) {
      for (const tagToRemove of tagsToRemove) {
        const tasksWithTag = tasks.filter((t) => t.tags?.includes(tagToRemove) && this.fileOperations.lineParser.hasTag(t.sourceLine ?? t.text, tagToRemove));
        for (const task of tasksWithTag) {
          tagChanges.push({
            taskId: getTaskId(task),
            filePath: task.file.path,
            lineNumber: task.line ?? 0,
            tag: tagToRemove,
            action: "removed",
          });
          tagChangeTasks.push(task);
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

    // Perform every per-task change in one file transaction.
    await this.fileOperations.batchMove(tasks, attributeName, attributeValue, this.settings.completedDateAttribute, tag, newStatus, tagsToRemove);

    taskChanges.forEach((change, index) => this.updateChangeIdentity(change, tasks[index]));
    statusChanges.forEach((change, index) => this.updateChangeIdentity(change, tasks[index]));
    tagChanges.forEach((change, index) => this.updateChangeIdentity(change, tagChangeTasks[index]));

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

  private needsAtomicApply(operation: UndoOperation): boolean {
    return operation.type === "batch" || [operation.taskChanges, operation.tagChanges, operation.statusChanges].filter((changes) => changes.length > 0).length > 1;
  }

  private async applyCombinedHistoryOperation<T>(operation: UndoOperation, resolved: Map<RecordedChange, TaskItem<T>>, undo: boolean): Promise<boolean> {
    const byTask = new Map<TaskItem<T>, TaskMutation<T>>();
    const mutationFor = (change: RecordedChange): TaskMutation<T> | undefined => {
      const task = resolved.get(change);
      if (!task) return undefined;
      let mutation = byTask.get(task);
      if (!mutation) {
        mutation = { task };
        byTask.set(task, mutation);
      }
      return mutation;
    };

    for (const change of operation.taskChanges) {
      const mutation = mutationFor(change);
      if (!mutation) return false;
      (mutation.attributes ??= []).push({ name: change.attributeName, value: undo ? change.previousValue : change.newValue });
    }
    for (const change of operation.tagChanges) {
      const mutation = mutationFor(change);
      if (!mutation) return false;
      const add = undo ? change.action === "removed" : change.action === "added";
      const tags = add ? (mutation.tagsToAdd ??= []) : (mutation.tagsToRemove ??= []);
      tags.push(change.tag);
    }
    for (const change of operation.statusChanges) {
      const mutation = mutationFor(change);
      if (!mutation) return false;
      mutation.status = undo ? change.previousStatus : change.newStatus;
      mutation.completedDate = (undo ? change.previousCompletedDate : change.newCompletedDate) ?? null;
    }

    try {
      await this.fileOperations.batchApplyMutations([...byTask.values()], this.settings.completedDateAttribute);
    } catch {
      return false;
    }
    for (const change of [...operation.taskChanges, ...operation.tagChanges, ...operation.statusChanges]) {
      const task = resolved.get(change);
      if (task) this.updateChangeIdentity(change, task);
    }
    return true;
  }

  /**
   * Apply an undo operation - restores previous values
   */
  applyUndo<T>(operation: UndoOperation, findTask: (taskId: string, filePath?: string, sourceLine?: string) => TaskItem<T> | undefined): Promise<boolean> {
    return this.serializeOperation(() => this.applyUndoNow(operation, findTask));
  }

  private async applyUndoNow<T>(operation: UndoOperation, findTask: (taskId: string, filePath?: string, sourceLine?: string) => TaskItem<T> | undefined): Promise<boolean> {
    let success = true;
    const { resolved, originals } = await this.resolveOperationTasks(operation, findTask);
    if (this.needsAtomicApply(operation)) {
      success = await this.applyCombinedHistoryOperation(operation, resolved, true);
      if (!success) this.undoManager.restoreFailedUndo(operation);
      return success;
    }
    const applied = new Set<TaskItem<T>>();
    const failed = new Set<TaskItem<T>>();

    for (const change of operation.taskChanges) {
      const changed = await this.applyChange(
        resolved.get(change),
        async (task) => {
          if (change.previousValue === undefined || change.previousValue === false) await this.fileOperations.removeAttribute(task, change.attributeName);
          else await this.fileOperations.updateAttribute(task, change.attributeName, change.previousValue);
        },
        originals,
        applied,
        failed
      );
      success = changed && success;
    }

    for (const change of operation.tagChanges) {
      const changed = await this.applyChange(
        resolved.get(change),
        async (task) => {
          if (change.action === "added") await this.fileOperations.removeTag(task, change.tag);
          else await this.fileOperations.appendTag(task, change.tag);
        },
        originals,
        applied,
        failed
      );
      success = changed && success;
    }

    for (const change of operation.statusChanges) {
      const changed = await this.applyChange(
        resolved.get(change),
        async (task) => {
          task.status = change.previousStatus;
          await this.fileOperations.updateTaskStatus(task, this.settings.completedDateAttribute, change.previousCompletedDate ?? null);
        },
        originals,
        applied,
        failed
      );
      success = changed && success;
    }

    this.updateOperationIdentities(resolved, applied);
    if (!success) this.undoManager.restoreFailedUndo(operation);
    return success;
  }

  /**
   * Apply a redo operation - restores new values
   */
  applyRedo<T>(operation: UndoOperation, findTask: (taskId: string, filePath?: string, sourceLine?: string) => TaskItem<T> | undefined): Promise<boolean> {
    return this.serializeOperation(() => this.applyRedoNow(operation, findTask));
  }

  private async applyRedoNow<T>(operation: UndoOperation, findTask: (taskId: string, filePath?: string, sourceLine?: string) => TaskItem<T> | undefined): Promise<boolean> {
    let success = true;
    const { resolved, originals } = await this.resolveOperationTasks(operation, findTask);
    if (this.needsAtomicApply(operation)) {
      success = await this.applyCombinedHistoryOperation(operation, resolved, false);
      if (!success) this.undoManager.restoreFailedRedo(operation);
      return success;
    }
    const applied = new Set<TaskItem<T>>();
    const failed = new Set<TaskItem<T>>();

    for (const change of operation.taskChanges) {
      const changed = await this.applyChange(
        resolved.get(change),
        async (task) => {
          if (change.newValue === undefined || change.newValue === false) await this.fileOperations.removeAttribute(task, change.attributeName);
          else await this.fileOperations.updateAttribute(task, change.attributeName, change.newValue);
        },
        originals,
        applied,
        failed
      );
      success = changed && success;
    }

    for (const change of operation.tagChanges) {
      const changed = await this.applyChange(
        resolved.get(change),
        async (task) => {
          if (change.action === "added") await this.fileOperations.appendTag(task, change.tag);
          else await this.fileOperations.removeTag(task, change.tag);
        },
        originals,
        applied,
        failed
      );
      success = changed && success;
    }

    for (const change of operation.statusChanges) {
      const changed = await this.applyChange(
        resolved.get(change),
        async (task) => {
          task.status = change.newStatus;
          await this.fileOperations.updateTaskStatus(task, this.settings.completedDateAttribute, change.newCompletedDate ?? null);
        },
        originals,
        applied,
        failed
      );
      success = changed && success;
    }

    this.updateOperationIdentities(resolved, applied);
    if (!success) this.undoManager.restoreFailedRedo(operation);
    return success;
  }
}
