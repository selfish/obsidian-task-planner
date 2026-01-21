import { moment, type Moment } from "../../utils";

/**
 * Lightweight natural language date parser.
 * Replaces chrono-node (~400kb) with a simple implementation using moment.js.
 */
export class Completion {
  private static readonly DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  private static readonly FULL_DAY_NAMES = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  private static readonly MONTH_NAMES = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];

  public static completeDate(prompt: string): string | null {
    const input = prompt.toLowerCase().trim();
    const result = this.parseDate(input);
    return result ? result.format("YYYY-MM-DD") : null;
  }

  private static parseDate(input: string): Moment | null {
    const today = moment();

    // Exact keywords
    if (input === "today" || input === "tod") {
      return today;
    }
    if (input === "tomorrow" || input === "tom" || input === "tmr" || input === "tmrw") {
      return today.clone().add(1, "day");
    }
    if (input === "yesterday") {
      return today.clone().subtract(1, "day");
    }

    // Day names (e.g., "monday", "mon", "next monday")
    const dayMatch = this.parseDayName(input, today);
    if (dayMatch) return dayMatch;

    // Relative patterns: "in N days/weeks/months"
    const relativeMatch = this.parseRelative(input, today);
    if (relativeMatch) return relativeMatch;

    // "next week" / "next month"
    if (input === "next week") {
      return today.clone().add(1, "week").startOf("week").add(1, "day"); // Monday
    }
    if (input === "next month") {
      return today.clone().add(1, "month").startOf("month");
    }

    // Month day: "jan 15", "january 15", "15 jan"
    const monthDayMatch = this.parseMonthDay(input, today);
    if (monthDayMatch) return monthDayMatch;

    // ISO date: "2024-01-15" or "2024/01/15"
    const isoMatch = input.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
      const result = moment(`${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`);
      if (result.isValid()) return result;
    }

    // US format: "1/15" or "1/15/24" or "01/15/2024"
    const usMatch = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (usMatch) {
      const month = parseInt(usMatch[1], 10);
      const day = parseInt(usMatch[2], 10);
      let year = usMatch[3] ? parseInt(usMatch[3], 10) : today.year();
      if (year < 100) year += 2000;
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const result = moment(dateStr);
      if (result.isValid()) {
        // Forward date: if in past, use next year
        if (result.isBefore(today) && !usMatch[3]) {
          result.add(1, "year");
        }
        return result;
      }
    }

    return null;
  }

  private static parseDayName(input: string, today: Moment): Moment | null {
    const hasNext = input.startsWith("next ");
    const cleanInput = hasNext ? input.slice(5) : input;

    let dayIndex = this.DAY_NAMES.indexOf(cleanInput);
    if (dayIndex === -1) {
      dayIndex = this.FULL_DAY_NAMES.indexOf(cleanInput);
    }

    if (dayIndex !== -1) {
      const todayDow = today.isoWeekday() % 7; // 0=Sun, 1=Mon, etc.
      let daysUntil = dayIndex - todayDow;

      // Forward date: always go to next occurrence
      if (daysUntil <= 0) {
        daysUntil += 7;
      }

      // "next monday" means the one after the coming one
      if (hasNext && daysUntil <= 7) {
        daysUntil += 7;
      }

      return today.clone().add(daysUntil, "day");
    }

    return null;
  }

  private static parseRelative(input: string, today: Moment): Moment | null {
    // "in N days/weeks/months" or "N days/weeks/months"
    const match = input.match(/^(?:in\s+)?(\d+|a|an)\s+(day|days|week|weeks|month|months)$/);
    if (match) {
      const amount = match[1] === "a" || match[1] === "an" ? 1 : parseInt(match[1], 10);
      const unit = match[2].replace(/s$/, "") as "day" | "week" | "month";
      return today.clone().add(amount, unit);
    }
    return null;
  }

  private static parseMonthDay(input: string, today: Moment): Moment | null {
    // "jan 15", "january 15", "15 jan", "15 january"
    for (let i = 0; i < this.MONTH_NAMES.length; i++) {
      const abbrev = this.MONTH_NAMES[i];
      const patterns = [
        new RegExp(`^${abbrev}\\w*\\s+(\\d{1,2})$`), // "jan 15", "january 15"
        new RegExp(`^(\\d{1,2})\\s+${abbrev}\\w*$`), // "15 jan", "15 january"
      ];

      for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) {
          const day = parseInt(match[1], 10);
          const year = today.year();
          const dateStr = `${year}-${String(i + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const result = moment(dateStr);
          if (result.isValid()) {
            // Forward date: if in past, use next year
            if (result.isBefore(today)) {
              result.add(1, "year");
            }
            return result;
          }
        }
      }
    }
    return null;
  }
}
