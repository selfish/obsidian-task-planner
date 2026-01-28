import { moment, Moment } from "./moment";

/**
 * Date option types for Reschedule and Follow-up menus
 */
export interface DateOption {
  label: string;
  icon: string;
  /** Returns the date string (YYYY-MM-DD) or null for backlog */
  getDate: (firstWeekday: number) => string | null;
}

/**
 * Calculate the start of next week based on the user's configured first weekday
 * @param firstWeekday - 0=Sunday, 1=Monday, etc.
 * @returns Moment representing the start of next week
 */
export function getStartOfNextWeek(firstWeekday: number): Moment {
  const today = moment().startOf("day");
  // moment().day() returns 0=Sunday, 6=Saturday
  const currentWeekday = today.day();
  let daysUntilNextWeekStart = (firstWeekday - currentWeekday + 7) % 7;
  if (daysUntilNextWeekStart === 0) {
    daysUntilNextWeekStart = 7; // If today is start of week, go to next week
  }
  return today.clone().add(daysUntilNextWeekStart, "days");
}

/**
 * Standard date options for Reschedule and Follow-up menus
 */
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

/**
 * All date options in order for menu display
 */
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
