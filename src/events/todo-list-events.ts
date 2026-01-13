import { TodoItem } from "../types/todo";

export type TodoFilter<T> = (todoItem: TodoItem<T>) => boolean;

export interface OpenFileEvent<T> {
  file: T;
  line: number;
  inOtherLeaf: boolean;
}
