import { TaskItem } from "../types";
import { moment, Moment } from "./moment";

export function findTaskDate<T>(task: TaskItem<T>, attribute: string): Moment | null {
  if (!task.attributes) {
    return null;
  }
  const attr = task.attributes[attribute];
  if (attr) {
    const d = moment(`${task.attributes[attribute]}`);
    return d.isValid() ? d : null;
  }
  return null;
}
