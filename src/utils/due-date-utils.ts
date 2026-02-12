import { moment, Moment } from "./moment";

export type DueDateVariant = "overdue" | "today" | "tomorrow" | "future";

export interface DueDateInfo {
  label: string;
  variant: DueDateVariant;
}

export function getDueDateInfo(dueDate: Moment): DueDateInfo {
  const today = moment().startOf("day");
  const tomorrow = today.clone().add(1, "day");

  if (dueDate.isBefore(today)) {
    return { label: "Overdue", variant: "overdue" };
  }
  if (dueDate.isSame(today, "day")) {
    return { label: "Due: Today", variant: "today" };
  }
  if (dueDate.isSame(tomorrow, "day")) {
    return { label: "Due: Tomorrow", variant: "tomorrow" };
  }
  return { label: `Due: ${dueDate.format("MMM D")}`, variant: "future" };
}
