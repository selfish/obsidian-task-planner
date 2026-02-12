import { TaskItem, getTaskId } from "../types/task";

export class HorizonDeduplicator<TFile> {
  private assignedTaskIds: Set<string> = new Set();

  markAsAssigned(todos: TaskItem<TFile>[]): void {
    for (const todo of todos) {
      this.assignedTaskIds.add(getTaskId(todo));
    }
  }

  isAssigned(todo: TaskItem<TFile>): boolean {
    return this.assignedTaskIds.has(getTaskId(todo));
  }

  filterExcluded(todos: TaskItem<TFile>[]): TaskItem<TFile>[] {
    return todos.filter((todo) => !this.isAssigned(todo));
  }

  filterAndMark(todos: TaskItem<TFile>[]): TaskItem<TFile>[] {
    const filtered = this.filterExcluded(todos);
    this.markAsAssigned(filtered);
    return filtered;
  }

  getExclusionSet(): Set<string> {
    return this.assignedTaskIds;
  }

  reset(): void {
    this.assignedTaskIds.clear();
  }

  get assignedCount(): number {
    return this.assignedTaskIds.size;
  }
}

export function filterTodosByTag<TFile>(todos: TaskItem<TFile>[], tag: string): TaskItem<TFile>[] {
  return todos.filter((todo) => todo.tags?.includes(tag));
}
