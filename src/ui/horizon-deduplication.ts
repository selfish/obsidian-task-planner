import { TodoItem, getTodoId } from "../types/todo";

/**
 * Helper class for tracking assigned tasks across horizons.
 * Prevents tasks from appearing in multiple horizons.
 */
export class HorizonDeduplicator<TFile> {
  private assignedTaskIds: Set<string> = new Set();

  /**
   * Marks the given todos as assigned, adding their IDs to the exclusion set.
   */
  markAsAssigned(todos: TodoItem<TFile>[]): void {
    for (const todo of todos) {
      this.assignedTaskIds.add(getTodoId(todo));
    }
  }

  /**
   * Checks if a todo has already been assigned to a horizon.
   */
  isAssigned(todo: TodoItem<TFile>): boolean {
    return this.assignedTaskIds.has(getTodoId(todo));
  }

  /**
   * Filters out todos that have already been assigned to a horizon.
   */
  filterExcluded(todos: TodoItem<TFile>[]): TodoItem<TFile>[] {
    return todos.filter((todo) => !this.isAssigned(todo));
  }

  /**
   * Filters todos, marks the remaining as assigned, and returns them.
   * This is a convenience method that combines filterExcluded and markAsAssigned.
   */
  filterAndMark(todos: TodoItem<TFile>[]): TodoItem<TFile>[] {
    const filtered = this.filterExcluded(todos);
    this.markAsAssigned(filtered);
    return filtered;
  }

  /**
   * Gets the current exclusion set for use with external filtering functions.
   */
  getExclusionSet(): Set<string> {
    return this.assignedTaskIds;
  }

  /**
   * Resets the deduplicator, clearing all assigned task IDs.
   */
  reset(): void {
    this.assignedTaskIds.clear();
  }

  /**
   * Gets the number of tasks currently marked as assigned.
   */
  get assignedCount(): number {
    return this.assignedTaskIds.size;
  }
}

/**
 * Filters todos by tag, returning only those that have the specified tag.
 */
export function filterTodosByTag<TFile>(todos: TodoItem<TFile>[], tag: string): TodoItem<TFile>[] {
  return todos.filter((todo) => todo.tags?.includes(tag));
}
