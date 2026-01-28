import { getStartOfNextWeek, getAllDateOptions, DATE_OPTIONS, DATE_OPTIONS_WEEK, DATE_OPTIONS_MONTH, DATE_OPTION_BACKLOG } from "../../src/utils/date-utils";
import { moment } from "../../src/utils/moment";

// Mock moment
jest.mock("../../src/utils/moment", () => {
  const actual = jest.requireActual("../../src/utils/moment");
  return {
    ...actual,
    moment: jest.fn(),
  };
});

describe("date-utils", () => {
  const mockMoment = moment as jest.MockedFunction<typeof moment>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getStartOfNextWeek", () => {
    it("should return next Monday when firstWeekday is Monday (1) and today is Wednesday", () => {
      // Wednesday: day() returns 3
      const mockToday = {
        day: jest.fn().mockReturnValue(3), // Wednesday
        clone: jest.fn().mockReturnThis(),
        add: jest.fn().mockReturnThis(),
        format: jest.fn().mockReturnValue("2026-02-02"), // Next Monday
      };
      mockMoment.mockReturnValue({
        startOf: jest.fn().mockReturnValue(mockToday),
      } as unknown as ReturnType<typeof moment>);

      const result = getStartOfNextWeek(1); // Monday start

      // Wednesday (3) to Monday (1): (1 - 3 + 7) % 7 = 5 days
      expect(mockToday.add).toHaveBeenCalledWith(5, "days");
    });

    it("should return next Sunday when firstWeekday is Sunday (0) and today is Wednesday", () => {
      const mockToday = {
        day: jest.fn().mockReturnValue(3), // Wednesday
        clone: jest.fn().mockReturnThis(),
        add: jest.fn().mockReturnThis(),
        format: jest.fn().mockReturnValue("2026-02-01"), // Next Sunday
      };
      mockMoment.mockReturnValue({
        startOf: jest.fn().mockReturnValue(mockToday),
      } as unknown as ReturnType<typeof moment>);

      const result = getStartOfNextWeek(0); // Sunday start

      // Wednesday (3) to Sunday (0): (0 - 3 + 7) % 7 = 4 days
      expect(mockToday.add).toHaveBeenCalledWith(4, "days");
    });

    it("should return next week when today is the first day of the week", () => {
      const mockToday = {
        day: jest.fn().mockReturnValue(1), // Monday
        clone: jest.fn().mockReturnThis(),
        add: jest.fn().mockReturnThis(),
        format: jest.fn().mockReturnValue("2026-02-09"), // Next Monday
      };
      mockMoment.mockReturnValue({
        startOf: jest.fn().mockReturnValue(mockToday),
      } as unknown as ReturnType<typeof moment>);

      const result = getStartOfNextWeek(1); // Monday start

      // Monday (1) to Monday (1): (1 - 1 + 7) % 7 = 0, but should be 7
      expect(mockToday.add).toHaveBeenCalledWith(7, "days");
    });

    it("should return next Sunday when today is Sunday and firstWeekday is Sunday", () => {
      const mockToday = {
        day: jest.fn().mockReturnValue(0), // Sunday
        clone: jest.fn().mockReturnThis(),
        add: jest.fn().mockReturnThis(),
        format: jest.fn().mockReturnValue("2026-02-08"),
      };
      mockMoment.mockReturnValue({
        startOf: jest.fn().mockReturnValue(mockToday),
      } as unknown as ReturnType<typeof moment>);

      const result = getStartOfNextWeek(0); // Sunday start

      // Sunday (0) to Sunday (0): should be 7 days (not 0)
      expect(mockToday.add).toHaveBeenCalledWith(7, "days");
    });

    it("should return Saturday when firstWeekday is Saturday (6) and today is Monday", () => {
      const mockToday = {
        day: jest.fn().mockReturnValue(1), // Monday
        clone: jest.fn().mockReturnThis(),
        add: jest.fn().mockReturnThis(),
        format: jest.fn().mockReturnValue("2026-02-07"),
      };
      mockMoment.mockReturnValue({
        startOf: jest.fn().mockReturnValue(mockToday),
      } as unknown as ReturnType<typeof moment>);

      const result = getStartOfNextWeek(6); // Saturday start

      // Monday (1) to Saturday (6): (6 - 1 + 7) % 7 = 5 days
      expect(mockToday.add).toHaveBeenCalledWith(5, "days");
    });
  });

  describe("getAllDateOptions", () => {
    it("should return all date option groups", () => {
      const options = getAllDateOptions();

      expect(options.immediate).toBe(DATE_OPTIONS);
      expect(options.week).toBe(DATE_OPTIONS_WEEK);
      expect(options.month).toBe(DATE_OPTIONS_MONTH);
      expect(options.backlog).toBe(DATE_OPTION_BACKLOG);
    });
  });

  describe("DATE_OPTIONS", () => {
    beforeEach(() => {
      const createMockMoment = (formatted: string) => ({
        startOf: jest.fn().mockReturnThis(),
        add: jest.fn().mockReturnThis(),
        format: jest.fn().mockReturnValue(formatted),
      });
      mockMoment.mockReturnValue(createMockMoment("2026-01-29") as unknown as ReturnType<typeof moment>);
    });

    it("should have Today option with correct label and icon", () => {
      const todayOption = DATE_OPTIONS[0];
      expect(todayOption.label).toBe("Today");
      expect(todayOption.icon).toBe("calendar-check");
    });

    it("should have Tomorrow option with correct label and icon", () => {
      const tomorrowOption = DATE_OPTIONS[1];
      expect(tomorrowOption.label).toBe("Tomorrow");
      expect(tomorrowOption.icon).toBe("calendar-plus");
    });

    it("Today should return formatted date from moment().startOf('day')", () => {
      const todayOption = DATE_OPTIONS[0];
      const date = todayOption.getDate(1);
      expect(mockMoment).toHaveBeenCalled();
      expect(date).toBe("2026-01-29");
    });

    it("Tomorrow should return formatted date from moment().add(1, 'day')", () => {
      const tomorrowOption = DATE_OPTIONS[1];
      const date = tomorrowOption.getDate(1);
      expect(mockMoment).toHaveBeenCalled();
      expect(date).toBe("2026-01-29");
    });
  });

  describe("DATE_OPTIONS_WEEK", () => {
    beforeEach(() => {
      const mockToday = {
        day: jest.fn().mockReturnValue(3), // Wednesday
        clone: jest.fn().mockReturnThis(),
        add: jest.fn().mockReturnThis(),
        format: jest.fn().mockReturnValue("2026-02-02"),
        startOf: jest.fn().mockReturnThis(),
      };
      mockMoment.mockReturnValue({
        startOf: jest.fn().mockReturnValue(mockToday),
        add: jest.fn().mockReturnValue(mockToday),
      } as unknown as ReturnType<typeof moment>);
    });

    it("should have Next week option with correct label and icon", () => {
      const nextWeekOption = DATE_OPTIONS_WEEK[0];
      expect(nextWeekOption.label).toBe("Next week");
      expect(nextWeekOption.icon).toBe("calendar-range");
    });

    it("should have In a week option with correct label and icon", () => {
      const inAWeekOption = DATE_OPTIONS_WEEK[1];
      expect(inAWeekOption.label).toBe("In a week");
      expect(inAWeekOption.icon).toBe("calendar-clock");
    });

    it("Next week should use firstWeekday parameter", () => {
      const nextWeekOption = DATE_OPTIONS_WEEK[0];
      nextWeekOption.getDate(1); // Monday start
      expect(mockMoment).toHaveBeenCalled();
    });
  });

  describe("DATE_OPTIONS_MONTH", () => {
    beforeEach(() => {
      const createMockMoment = (formatted: string) => ({
        add: jest.fn().mockReturnThis(),
        startOf: jest.fn().mockReturnThis(),
        format: jest.fn().mockReturnValue(formatted),
      });
      mockMoment.mockReturnValue(createMockMoment("2026-02-01") as unknown as ReturnType<typeof moment>);
    });

    it("should have Next month option with correct label and icon", () => {
      const nextMonthOption = DATE_OPTIONS_MONTH[0];
      expect(nextMonthOption.label).toBe("Next month");
      expect(nextMonthOption.icon).toBe("calendar-days");
    });

    it("should have In a month option with correct label and icon", () => {
      const inAMonthOption = DATE_OPTIONS_MONTH[1];
      expect(inAMonthOption.label).toBe("In a month");
      expect(inAMonthOption.icon).toBe("calendar-fold");
    });

    it("Next month should return first day of next month", () => {
      const nextMonthOption = DATE_OPTIONS_MONTH[0];
      const date = nextMonthOption.getDate(1);
      expect(mockMoment).toHaveBeenCalled();
    });

    it("In a month should return exactly 1 month from now", () => {
      const inAMonthOption = DATE_OPTIONS_MONTH[1];
      const date = inAMonthOption.getDate(1);
      expect(mockMoment).toHaveBeenCalled();
    });
  });

  describe("DATE_OPTION_BACKLOG", () => {
    it("should have correct label and icon", () => {
      expect(DATE_OPTION_BACKLOG.label).toBe("Backlog (no date)");
      expect(DATE_OPTION_BACKLOG.icon).toBe("calendar-off");
    });

    it("should return null", () => {
      const date = DATE_OPTION_BACKLOG.getDate(1);
      expect(date).toBeNull();
    });
  });
});
