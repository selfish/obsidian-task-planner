import { TodoItem } from "../domain/TodoItem";

export type TodoFilter<T> = (todoItem: TodoItem<T>) => boolean;

export interface OpenFileEvent<T> {
  file: T;
  line: number;
  inOtherLeaf: boolean;
}
