import { FileOperations } from "./file-operations";
import { UndoManager, UndoOperation, TaskChange, StatusChange, TagChange } from "./undo-manager";
import { TaskPlannerSettings } from "../../settings";
import { TodoItem, TodoStatus, getTodoId } from "../../types";
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
  async updateAttributeWithUndo<T>(todo: TodoItem<T>, attributeName: string, attributeValue: string | boolean | undefined, description: string): Promise<void> {
    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.updateAttribute(todo, attributeName, attributeValue);
      return;
    }

    const previousValue = todo.attributes?.[attributeName];
    const todoId = getTodoId(todo);

    await this.fileOperations.updateAttribute(todo, attributeName, attributeValue);

    const taskChange: TaskChange = {
      todoId,
      filePath: todo.file.path,
      lineNumber: todo.line ?? 0,
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
  async removeAttributeWithUndo<T>(todo: TodoItem<T>, attributeName: string, description: string): Promise<void> {
    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.removeAttribute(todo, attributeName);
      return;
    }

    const previousValue = todo.attributes?.[attributeName];
    const todoId = getTodoId(todo);

    await this.fileOperations.removeAttribute(todo, attributeName);

    const taskChange: TaskChange = {
      todoId,
      filePath: todo.file.path,
      lineNumber: todo.line ?? 0,
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
   * Update todo status with undo tracking
   */
  async updateTodoStatusWithUndo<T>(todo: TodoItem<T>, previousStatus: TodoStatus, description: string): Promise<void> {
    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.updateTodoStatus(todo, this.settings.completedDateAttribute);
      return;
    }

    const todoId = getTodoId(todo);
    const isCompleted = todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled;
    const wasCompleted = previousStatus === TodoStatus.Complete || previousStatus === TodoStatus.Canceled;
    const previousCompletedDate = wasCompleted ? (todo.attributes?.[this.settings.completedDateAttribute] as string | undefined) : undefined;
    const newCompletedDate = isCompleted ? moment().format("YYYY-MM-DD") : undefined;

    await this.fileOperations.updateTodoStatus(todo, this.settings.completedDateAttribute);

    const statusChange: StatusChange = {
      todoId,
      filePath: todo.file.path,
      lineNumber: todo.line ?? 0,
      previousStatus,
      newStatus: todo.status,
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
  async appendTagWithUndo<T>(todo: TodoItem<T>, tag: string, description: string): Promise<void> {
    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.appendTag(todo, tag);
      return;
    }

    // Check if tag already exists - if so, skip
    if (todo.tags?.includes(tag)) {
      return;
    }

    const todoId = getTodoId(todo);

    await this.fileOperations.appendTag(todo, tag);

    const tagChange: TagChange = {
      todoId,
      filePath: todo.file.path,
      lineNumber: todo.line ?? 0,
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
   * Batch update attribute with undo tracking for multiple todos
   */
  async batchUpdateAttributeWithUndo<T>(todos: TodoItem<T>[], attributeName: string, attributeValue: string | boolean | undefined, description: string): Promise<void> {
    if (todos.length === 0) return;

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchUpdateAttribute(todos, attributeName, attributeValue);
      return;
    }

    // Capture previous values before the update
    const taskChanges: TaskChange[] = todos.map((todo) => ({
      todoId: getTodoId(todo),
      filePath: todo.file.path,
      lineNumber: todo.line ?? 0,
      attributeName,
      previousValue: todo.attributes?.[attributeName],
      newValue: attributeValue,
    }));

    await this.fileOperations.batchUpdateAttribute(todos, attributeName, attributeValue);

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
  async batchRemoveAttributeWithUndo<T>(todos: TodoItem<T>[], attributeName: string, description: string): Promise<void> {
    if (todos.length === 0) return;

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchRemoveAttribute(todos, attributeName);
      return;
    }

    // Capture previous values
    const taskChanges: TaskChange[] = todos.map((todo) => ({
      todoId: getTodoId(todo),
      filePath: todo.file.path,
      lineNumber: todo.line ?? 0,
      attributeName,
      previousValue: todo.attributes?.[attributeName],
      newValue: undefined,
    }));

    await this.fileOperations.batchRemoveAttribute(todos, attributeName);

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
   * Batch update todo status with undo tracking
   */
  async batchUpdateTodoStatusWithUndo<T>(todos: TodoItem<T>[], previousStatuses: Map<string, TodoStatus>, description: string): Promise<void> {
    if (todos.length === 0) return;

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchUpdateTodoStatus(todos, this.settings.completedDateAttribute);
      return;
    }

    const statusChanges: StatusChange[] = todos.map((todo) => {
      const todoId = getTodoId(todo);
      const previousStatus = previousStatuses.get(todoId) ?? todo.status;
      const isCompleted = todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled;
      const wasCompleted = previousStatus === TodoStatus.Complete || previousStatus === TodoStatus.Canceled;
      const previousCompletedDate = wasCompleted ? (todo.attributes?.[this.settings.completedDateAttribute] as string | undefined) : undefined;
      const newCompletedDate = isCompleted ? moment().format("YYYY-MM-DD") : undefined;

      return {
        todoId,
        filePath: todo.file.path,
        lineNumber: todo.line ?? 0,
        previousStatus,
        newStatus: todo.status,
        previousCompletedDate,
        newCompletedDate,
      };
    });

    await this.fileOperations.batchUpdateTodoStatus(todos, this.settings.completedDateAttribute);

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
  async batchAppendTagWithUndo<T>(todos: TodoItem<T>[], tag: string, description: string): Promise<void> {
    // Filter out todos that already have the tag
    const todosNeedingTag = todos.filter((t) => !t.tags?.includes(tag));
    if (todosNeedingTag.length === 0) return;

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchAppendTag(todos, tag);
      return;
    }

    const tagChanges: TagChange[] = todosNeedingTag.map((todo) => ({
      todoId: getTodoId(todo),
      filePath: todo.file.path,
      lineNumber: todo.line ?? 0,
      tag,
      action: "added" as const,
    }));

    await this.fileOperations.batchAppendTag(todos, tag);

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
  async combinedMoveWithUndo<T>(todos: TodoItem<T>[], attributeName: string, attributeValue: string | boolean | undefined, tag?: string, newStatus?: TodoStatus, description?: string, tagsToRemove?: string[]): Promise<void> {
    if (todos.length === 0) return;

    const effectiveDescription = description ?? UndoManager.createMoveDescription(todos.length, String(attributeValue));

    if (!this.undoManager.isEnabled()) {
      await this.fileOperations.batchUpdateAttribute(todos, attributeName, attributeValue);
      if (tag) {
        await this.fileOperations.batchAppendTag(todos, tag);
      }
      if (tagsToRemove && tagsToRemove.length > 0) {
        for (const tagToRemove of tagsToRemove) {
          await this.fileOperations.batchRemoveTag(todos, tagToRemove);
        }
      }
      if (newStatus !== undefined) {
        todos.forEach((t) => (t.status = newStatus));
        await this.fileOperations.batchUpdateTodoStatus(todos, this.settings.completedDateAttribute);
      }
      return;
    }

    // Capture all pre-operation state
    const taskChanges: TaskChange[] = todos.map((todo) => ({
      todoId: getTodoId(todo),
      filePath: todo.file.path,
      lineNumber: todo.line ?? 0,
      attributeName,
      previousValue: todo.attributes?.[attributeName],
      newValue: attributeValue,
    }));

    const tagChanges: TagChange[] = [];
    if (tag) {
      const todosNeedingTag = todos.filter((t) => !t.tags?.includes(tag));
      for (const todo of todosNeedingTag) {
        tagChanges.push({
          todoId: getTodoId(todo),
          filePath: todo.file.path,
          lineNumber: todo.line ?? 0,
          tag,
          action: "added",
        });
      }
    }

    // Record tag removals
    if (tagsToRemove && tagsToRemove.length > 0) {
      for (const tagToRemove of tagsToRemove) {
        const todosWithTag = todos.filter((t) => t.tags?.includes(tagToRemove));
        for (const todo of todosWithTag) {
          tagChanges.push({
            todoId: getTodoId(todo),
            filePath: todo.file.path,
            lineNumber: todo.line ?? 0,
            tag: tagToRemove,
            action: "removed",
          });
        }
      }
    }

    const statusChanges: StatusChange[] = [];
    if (newStatus !== undefined) {
      for (const todo of todos) {
        const todoId = getTodoId(todo);
        const previousStatus = todo.status;
        const isCompleted = newStatus === TodoStatus.Complete || newStatus === TodoStatus.Canceled;
        const wasCompleted = previousStatus === TodoStatus.Complete || previousStatus === TodoStatus.Canceled;
        const previousCompletedDate = wasCompleted ? (todo.attributes?.[this.settings.completedDateAttribute] as string | undefined) : undefined;
        const newCompletedDate = isCompleted ? moment().format("YYYY-MM-DD") : undefined;

        statusChanges.push({
          todoId,
          filePath: todo.file.path,
          lineNumber: todo.line ?? 0,
          previousStatus,
          newStatus,
          previousCompletedDate,
          newCompletedDate,
        });
      }
    }

    // Perform the actual operations
    await this.fileOperations.batchUpdateAttribute(todos, attributeName, attributeValue);
    if (tag) {
      await this.fileOperations.batchAppendTag(todos, tag);
    }
    if (tagsToRemove && tagsToRemove.length > 0) {
      for (const tagToRemove of tagsToRemove) {
        await this.fileOperations.batchRemoveTag(todos, tagToRemove);
      }
    }
    if (newStatus !== undefined) {
      todos.forEach((t) => (t.status = newStatus));
      await this.fileOperations.batchUpdateTodoStatus(todos, this.settings.completedDateAttribute);
    }

    // Record combined operation
    const operation: UndoOperation = {
      id: UndoManager.generateOperationId(),
      timestamp: Date.now(),
      type: todos.length > 1 ? "batch" : "single",
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
  async applyUndo<T>(operation: UndoOperation, findTodo: (todoId: string) => TodoItem<T> | undefined): Promise<boolean> {
    let success = true;

    // Restore task attribute changes
    for (const change of operation.taskChanges) {
      const todo = findTodo(change.todoId);
      if (todo) {
        try {
          if (change.previousValue === undefined || change.previousValue === false) {
            await this.fileOperations.removeAttribute(todo, change.attributeName);
          } else {
            await this.fileOperations.updateAttribute(todo, change.attributeName, change.previousValue);
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
      const todo = findTodo(change.todoId);
      if (todo) {
        try {
          if (change.action === "added") {
            // Tag was added, so remove it
            await this.fileOperations.removeTag(todo, change.tag);
          } else {
            // Tag was removed, so add it back
            await this.fileOperations.appendTag(todo, change.tag);
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
      const todo = findTodo(change.todoId);
      if (todo) {
        try {
          todo.status = change.previousStatus;
          await this.fileOperations.updateTodoStatus(todo, this.settings.completedDateAttribute);
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
  async applyRedo<T>(operation: UndoOperation, findTodo: (todoId: string) => TodoItem<T> | undefined): Promise<boolean> {
    let success = true;

    // Reapply task attribute changes
    for (const change of operation.taskChanges) {
      const todo = findTodo(change.todoId);
      if (todo) {
        try {
          if (change.newValue === undefined || change.newValue === false) {
            await this.fileOperations.removeAttribute(todo, change.attributeName);
          } else {
            await this.fileOperations.updateAttribute(todo, change.attributeName, change.newValue);
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
      const todo = findTodo(change.todoId);
      if (todo) {
        try {
          if (change.action === "added") {
            // Tag was added, so add it again
            await this.fileOperations.appendTag(todo, change.tag);
          } else {
            // Tag was removed, so remove it again
            await this.fileOperations.removeTag(todo, change.tag);
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
      const todo = findTodo(change.todoId);
      if (todo) {
        try {
          todo.status = change.newStatus;
          await this.fileOperations.updateTodoStatus(todo, this.settings.completedDateAttribute);
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
