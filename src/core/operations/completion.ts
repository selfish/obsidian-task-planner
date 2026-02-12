import { moment, type Moment } from "../../utils";

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const FULL_DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export class Completion {
  static completeDate(prompt: string): string | null {
    const input = prompt.toLowerCase().trim();
    const result = this.parseDate(input);
    return result ? result.format("YYYY-MM-DD") : null;
  }

  private static parseDate(input: string): Moment | null {
    const today = moment();

    if (input === "today" || input === "tod") {
      return today;
    }
    if (input === "tomorrow" || input === "tom" || input === "tmr" || input === "tmrw") {
      return today.clone().add(1, "day");
    }
    if (input === "yesterday") {
      return today.clone().subtract(1, "day");
    }

    const dayMatch = this.parseDayName(input, today);
    if (dayMatch) return dayMatch;

    const relativeMatch = this.parseRelative(input, today);
    if (relativeMatch) return relativeMatch;

    if (input === "next week") {
      return today.clone().add(1, "week").startOf("week").add(1, "day");
    }
    if (input === "next month") {
      return today.clone().add(1, "month").startOf("month");
    }

    const monthDayMatch = this.parseMonthDay(input, today);
    if (monthDayMatch) return monthDayMatch;

    const isoMatch = input.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
      const result = moment(`${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`);
      if (result.isValid()) return result;
    }

    const usMatch = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (usMatch) {
      const month = parseInt(usMatch[1], 10);
      const day = parseInt(usMatch[2], 10);
      let year = usMatch[3] ? parseInt(usMatch[3], 10) : today.year();
      if (year < 100) year += 2000;
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const result = moment(dateStr);
      if (result.isValid()) {
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

    let dayIndex = DAY_NAMES.indexOf(cleanInput);
    if (dayIndex === -1) {
      dayIndex = FULL_DAY_NAMES.indexOf(cleanInput);
    }

    if (dayIndex !== -1) {
      const todayDow = today.isoWeekday() % 7;
      let daysUntil = dayIndex - todayDow;

      if (daysUntil <= 0) {
        daysUntil += 7;
      }

      if (hasNext && daysUntil <= 7) {
        daysUntil += 7;
      }

      return today.clone().add(daysUntil, "day");
    }

    return null;
  }

  private static parseRelative(input: string, today: Moment): Moment | null {
    const match = input.match(/^(?:in\s+)?(\d+|a|an)\s+(day|days|week|weeks|month|months)$/);
    if (match) {
      const amount = match[1] === "a" || match[1] === "an" ? 1 : parseInt(match[1], 10);
      const unit = match[2].replace(/s$/, "") as "day" | "week" | "month";
      return today.clone().add(amount, unit);
    }
    return null;
  }

  private static parseMonthDay(input: string, today: Moment): Moment | null {
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      const abbrev = MONTH_NAMES[i];
      const patterns = [
        new RegExp(`^${abbrev}\\w*\\s+(\\d{1,2})$`),
        new RegExp(`^(\\d{1,2})\\s+${abbrev}\\w*$`),
      ];

      for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) {
          const day = parseInt(match[1], 10);
          const year = today.year();
          const dateStr = `${year}-${String(i + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const result = moment(dateStr);
          if (result.isValid()) {
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
