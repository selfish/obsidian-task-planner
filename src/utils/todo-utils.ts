import { TodoItem } from "../types";
import { moment, Moment } from "./moment";

export function findTodoDate<T>(todo: TodoItem<T>, attribute: string): Moment | null {
  if (!todo.attributes) {
    return null;
  }
  const attr = todo.attributes[attribute];
  if (attr) {
    const d = moment(`${todo.attributes[attribute]}`);
    return d.isValid() ? d : null;
  }
  return null;
}
