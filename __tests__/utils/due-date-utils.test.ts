import { getDueDateInfo } from "../../src/utils/due-date-utils";
import { moment } from "../../src/utils/moment";

describe("getDueDateInfo", () => {
  describe("overdue dates", () => {
    it("should return overdue for yesterday", () => {
      const yesterday = moment().subtract(1, "day").startOf("day");
      const result = getDueDateInfo(yesterday);

      expect(result.label).toBe("Overdue");
      expect(result.variant).toBe("overdue");
    });

    it("should return overdue for dates far in the past", () => {
      const pastDate = moment().subtract(30, "days").startOf("day");
      const result = getDueDateInfo(pastDate);

      expect(result.label).toBe("Overdue");
      expect(result.variant).toBe("overdue");
    });
  });

  describe("today", () => {
    it("should return today variant for current day", () => {
      const today = moment().startOf("day");
      const result = getDueDateInfo(today);

      expect(result.label).toBe("Due: Today");
      expect(result.variant).toBe("today");
    });

    it("should return today for any time on current day", () => {
      const todayNoon = moment().startOf("day").add(12, "hours");
      const result = getDueDateInfo(todayNoon);

      expect(result.label).toBe("Due: Today");
      expect(result.variant).toBe("today");
    });
  });

  describe("tomorrow", () => {
    it("should return tomorrow variant for next day", () => {
      const tomorrow = moment().add(1, "day").startOf("day");
      const result = getDueDateInfo(tomorrow);

      expect(result.label).toBe("Due: Tomorrow");
      expect(result.variant).toBe("tomorrow");
    });
  });

  describe("future dates", () => {
    it("should return future variant for dates after tomorrow", () => {
      const futureDate = moment().add(2, "days").startOf("day");
      const result = getDueDateInfo(futureDate);

      expect(result.variant).toBe("future");
      expect(result.label).toMatch(/^Due: [A-Z][a-z]{2} \d{1,2}$/);
    });

    it("should return future variant for next week", () => {
      const nextWeek = moment().add(7, "days").startOf("day");
      const result = getDueDateInfo(nextWeek);

      expect(result.variant).toBe("future");
      expect(result.label).toMatch(/^Due: [A-Z][a-z]{2} \d{1,2}$/);
    });

    it("should return future variant for next month", () => {
      const nextMonth = moment().add(1, "month").startOf("day");
      const result = getDueDateInfo(nextMonth);

      expect(result.variant).toBe("future");
      expect(result.label).toMatch(/^Due: [A-Z][a-z]{2} \d{1,2}$/);
    });

    it("should format date as 'MMM D' (e.g., Jan 15)", () => {
      // Use a specific date to test formatting
      const specificDate = moment("2025-03-15").startOf("day");
      // Only test if it's in the future
      if (specificDate.isAfter(moment().add(1, "day"))) {
        const result = getDueDateInfo(specificDate);
        expect(result.label).toBe("Due: Mar 15");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle date exactly at midnight", () => {
      const midnight = moment().startOf("day");
      const result = getDueDateInfo(midnight);

      expect(result.label).toBe("Due: Today");
      expect(result.variant).toBe("today");
    });

    it("should handle date just before midnight", () => {
      const beforeMidnight = moment().startOf("day").add(23, "hours").add(59, "minutes");
      const result = getDueDateInfo(beforeMidnight);

      expect(result.label).toBe("Due: Today");
      expect(result.variant).toBe("today");
    });
  });
});
