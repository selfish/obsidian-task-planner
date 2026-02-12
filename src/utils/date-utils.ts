import { moment, Moment } from "./moment";

export interface DateOption {
  label: string;
  icon: string;
  getDate: (firstWeekday: number) => string | null;
}

export function getStartOfNextWeek(firstWeekday: number): Moment {
  const today = moment().startOf("day");
  // moment().day() returns 0=Sunday, 6=Saturday
  const currentWeekday = today.day();
  let daysUntilNextWeekStart = (firstWeekday - currentWeekday + 7) % 7;
  if (daysUntilNextWeekStart === 0) {
    daysUntilNextWeekStart = 7;
  }
  return today.clone().add(daysUntilNextWeekStart, "days");
}

export const DATE_OPTIONS: DateOption[] = [
  {
    label: "Today",
    icon: "calendar-check",
    getDate: () => moment().startOf("day").format("YYYY-MM-DD"),
  },
  {
    label: "Tomorrow",
    icon: "calendar-plus",
    getDate: () => moment().add(1, "day").format("YYYY-MM-DD"),
  },
];

export const DATE_OPTIONS_WEEK: DateOption[] = [
  {
    label: "Next week",
    icon: "calendar-range",
    getDate: (firstWeekday) => getStartOfNextWeek(firstWeekday).format("YYYY-MM-DD"),
  },
  {
    label: "In a week",
    icon: "calendar-clock",
    getDate: () => moment().add(1, "week").format("YYYY-MM-DD"),
  },
];

export const DATE_OPTIONS_MONTH: DateOption[] = [
  {
    label: "Next month",
    icon: "calendar-days",
    getDate: () => moment().add(1, "month").startOf("month").format("YYYY-MM-DD"),
  },
  {
    label: "In a month",
    icon: "calendar-fold",
    getDate: () => moment().add(1, "month").format("YYYY-MM-DD"),
  },
];

export const DATE_OPTION_BACKLOG: DateOption = {
  label: "Backlog (no date)",
  icon: "calendar-off",
  getDate: () => null,
};

export function getAllDateOptions(): {
  immediate: DateOption[];
  week: DateOption[];
  month: DateOption[];
  backlog: DateOption;
} {
  return {
    immediate: DATE_OPTIONS,
    week: DATE_OPTIONS_WEEK,
    month: DATE_OPTIONS_MONTH,
    backlog: DATE_OPTION_BACKLOG,
  };
}
