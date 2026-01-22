import { Completion } from '../../src/core/operations/completion';

describe('Completion', () => {
  describe('completeDate', () => {
    it('should parse "tomorrow" into ISO date', () => {
      const result = Completion.completeDate('tomorrow');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should parse "today" into ISO date', () => {
      const result = Completion.completeDate('today');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should parse "next friday" into ISO date', () => {
      const result = Completion.completeDate('next friday');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should parse "January 15" into ISO date', () => {
      const result = Completion.completeDate('January 15');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should parse "in 3 days" into ISO date', () => {
      const result = Completion.completeDate('in 3 days');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return null for non-date strings', () => {
      const result = Completion.completeDate('buy groceries');
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = Completion.completeDate('');
      expect(result).toBeNull();
    });

    it('should return null for random text', () => {
      const result = Completion.completeDate('asdfghjkl');
      expect(result).toBeNull();
    });
  });

  describe('completeDate - keywords', () => {
    beforeEach(() => {
      // Set a fixed date: Wednesday, January 15, 2025
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // Line 50: yesterday keyword
    it('should parse "yesterday" to the previous day', () => {
      const result = Completion.completeDate('yesterday');
      expect(result).toBe('2025-01-14');
    });

    // Short aliases for today and tomorrow
    it('should parse "tod" as today', () => {
      const result = Completion.completeDate('tod');
      expect(result).toBe('2025-01-15');
    });

    it('should parse "tom" as tomorrow', () => {
      const result = Completion.completeDate('tom');
      expect(result).toBe('2025-01-16');
    });

    it('should parse "tmr" as tomorrow', () => {
      const result = Completion.completeDate('tmr');
      expect(result).toBe('2025-01-16');
    });

    it('should parse "tmrw" as tomorrow', () => {
      const result = Completion.completeDate('tmrw');
      expect(result).toBe('2025-01-16');
    });

    // Line 63: next week keyword
    it('should parse "next week" to Monday of next week', () => {
      const result = Completion.completeDate('next week');
      // Jan 15, 2025 is Wednesday, so next Monday is Jan 20
      expect(result).toBe('2025-01-20');
    });

    // Line 66: next month keyword
    it('should parse "next month" to first day of next month', () => {
      const result = Completion.completeDate('next month');
      expect(result).toBe('2025-02-01');
    });
  });

  describe('completeDate - ISO date format', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // Lines 76-77: ISO date format parsing
    it('should parse ISO date with dashes "2024-01-15"', () => {
      const result = Completion.completeDate('2024-01-15');
      expect(result).toBe('2024-01-15');
    });

    it('should parse ISO date with slashes "2024/01/15"', () => {
      const result = Completion.completeDate('2024/01/15');
      expect(result).toBe('2024-01-15');
    });

    it('should parse ISO date with single digit month/day "2024-1-5"', () => {
      const result = Completion.completeDate('2024-1-5');
      expect(result).toBe('2024-01-05');
    });

    it('should parse ISO date with mixed separators-like format "2024/1/5"', () => {
      const result = Completion.completeDate('2024/1/5');
      expect(result).toBe('2024-01-05');
    });

    // Line 77: invalid ISO date branch - moment.isValid() returns false
    it('should return null for invalid ISO date "2024-13-45"', () => {
      const result = Completion.completeDate('2024-13-45');
      expect(result).toBeNull();
    });

    it('should return null for invalid ISO date "2024-00-00"', () => {
      const result = Completion.completeDate('2024-00-00');
      expect(result).toBeNull();
    });
  });

  describe('completeDate - US date format', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // Lines 83-94: US date format parsing
    it('should parse US date without year "1/20" (future date this year)', () => {
      const result = Completion.completeDate('1/20');
      expect(result).toBe('2025-01-20');
    });

    it('should parse US date without year "12/25" (future date this year)', () => {
      const result = Completion.completeDate('12/25');
      expect(result).toBe('2025-12-25');
    });

    it('should parse US date without year in the past and roll to next year "1/10"', () => {
      // Jan 10 is before Jan 15, so it should roll to 2026
      const result = Completion.completeDate('1/10');
      expect(result).toBe('2026-01-10');
    });

    it('should parse US date with 2-digit year "1/15/24"', () => {
      const result = Completion.completeDate('1/15/24');
      expect(result).toBe('2024-01-15');
    });

    it('should parse US date with 2-digit year "12/25/25"', () => {
      const result = Completion.completeDate('12/25/25');
      expect(result).toBe('2025-12-25');
    });

    it('should parse US date with 4-digit year "01/15/2024"', () => {
      const result = Completion.completeDate('01/15/2024');
      expect(result).toBe('2024-01-15');
    });

    it('should parse US date with 4-digit year "12/25/2030"', () => {
      const result = Completion.completeDate('12/25/2030');
      expect(result).toBe('2030-12-25');
    });

    it('should parse US date with single digit month and day "3/5"', () => {
      const result = Completion.completeDate('3/5');
      expect(result).toBe('2025-03-05');
    });

    it('should not roll over US date with explicit year even if in past "1/10/2024"', () => {
      const result = Completion.completeDate('1/10/2024');
      // With explicit year, should not roll to next year
      expect(result).toBe('2024-01-10');
    });

    // Line 89: invalid US date branch - moment.isValid() returns false
    it('should return null for invalid US date "13/45"', () => {
      const result = Completion.completeDate('13/45');
      expect(result).toBeNull();
    });

    it('should return null for invalid US date "0/0"', () => {
      const result = Completion.completeDate('0/0');
      expect(result).toBeNull();
    });

    it('should return null for invalid US date with year "99/99/2024"', () => {
      const result = Completion.completeDate('99/99/2024');
      expect(result).toBeNull();
    });
  });

  describe('completeDate - day names that have passed this week', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Set to Wednesday, January 15, 2025
      jest.setSystemTime(new Date('2025-01-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // Line 116: day name parsing when the day has already passed this week
    it('should parse "monday" to next Monday when today is Wednesday', () => {
      // Today is Wednesday (Jan 15), Monday has passed, so next Monday is Jan 20
      const result = Completion.completeDate('monday');
      expect(result).toBe('2025-01-20');
    });

    it('should parse "mon" to next Monday when today is Wednesday', () => {
      const result = Completion.completeDate('mon');
      expect(result).toBe('2025-01-20');
    });

    it('should parse "tuesday" to next Tuesday when today is Wednesday', () => {
      // Tuesday has passed, so next Tuesday is Jan 21
      const result = Completion.completeDate('tuesday');
      expect(result).toBe('2025-01-21');
    });

    it('should parse "tue" to next Tuesday when today is Wednesday', () => {
      const result = Completion.completeDate('tue');
      expect(result).toBe('2025-01-21');
    });

    it('should parse "sunday" to next Sunday when today is Wednesday', () => {
      // Sunday has passed (Jan 12), so next Sunday is Jan 19
      const result = Completion.completeDate('sunday');
      expect(result).toBe('2025-01-19');
    });

    it('should parse "sun" to next Sunday when today is Wednesday', () => {
      const result = Completion.completeDate('sun');
      expect(result).toBe('2025-01-19');
    });

    it('should parse "wednesday" (same day) to next Wednesday', () => {
      // Today is Wednesday, so "wednesday" should mean next Wednesday (Jan 22)
      const result = Completion.completeDate('wednesday');
      expect(result).toBe('2025-01-22');
    });

    it('should parse "wed" (same day) to next Wednesday', () => {
      const result = Completion.completeDate('wed');
      expect(result).toBe('2025-01-22');
    });

    it('should parse "thursday" to this Thursday when today is Wednesday', () => {
      // Thursday is tomorrow (Jan 16)
      const result = Completion.completeDate('thursday');
      expect(result).toBe('2025-01-16');
    });

    it('should parse "friday" to this Friday when today is Wednesday', () => {
      // Friday is Jan 17
      const result = Completion.completeDate('friday');
      expect(result).toBe('2025-01-17');
    });

    it('should parse "saturday" to this Saturday when today is Wednesday', () => {
      // Saturday is Jan 18
      const result = Completion.completeDate('saturday');
      expect(result).toBe('2025-01-18');
    });
  });

  describe('completeDate - day names on different starting days', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('should parse "friday" to next Friday when today is Friday', () => {
      // Set to Friday, January 17, 2025
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-17T12:00:00'));

      // Friday is today, so "friday" should mean next Friday (Jan 24)
      const result = Completion.completeDate('friday');
      expect(result).toBe('2025-01-24');
    });

    it('should parse "sunday" to tomorrow when today is Saturday', () => {
      // Set to Saturday, January 18, 2025
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-18T12:00:00'));

      // Sunday is tomorrow (Jan 19)
      const result = Completion.completeDate('sunday');
      expect(result).toBe('2025-01-19');
    });

    it('should parse "monday" to tomorrow when today is Sunday', () => {
      // Set to Sunday, January 19, 2025
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-19T12:00:00'));

      // Monday is tomorrow (Jan 20)
      const result = Completion.completeDate('monday');
      expect(result).toBe('2025-01-20');
    });
  });

  describe('completeDate - relative date parsing', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // Line 134: test "a" keyword branch
    it('should parse "in a day" as 1 day from now', () => {
      const result = Completion.completeDate('in a day');
      expect(result).toBe('2025-01-16');
    });

    // Line 134: test "an" keyword branch (uncovered)
    it('should parse "an week" as 1 week from now', () => {
      const result = Completion.completeDate('an week');
      expect(result).toBe('2025-01-22');
    });

    it('should parse "a week" as 1 week from now', () => {
      const result = Completion.completeDate('a week');
      expect(result).toBe('2025-01-22');
    });

    it('should parse "in a week" as 1 week from now', () => {
      const result = Completion.completeDate('in a week');
      expect(result).toBe('2025-01-22');
    });

    it('should parse "a month" as 1 month from now', () => {
      const result = Completion.completeDate('a month');
      expect(result).toBe('2025-02-15');
    });

    it('should parse "in a month" as 1 month from now', () => {
      const result = Completion.completeDate('in a month');
      expect(result).toBe('2025-02-15');
    });

    it('should parse "2 weeks" as 2 weeks from now', () => {
      const result = Completion.completeDate('2 weeks');
      expect(result).toBe('2025-01-29');
    });

    it('should parse "in 2 months" as 2 months from now', () => {
      const result = Completion.completeDate('in 2 months');
      expect(result).toBe('2025-03-15');
    });
  });

  describe('completeDate - month-day parsing', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // Lines 157-159: invalid month-day combination branch
    it('should return null for invalid month-day "jan 32"', () => {
      const result = Completion.completeDate('jan 32');
      expect(result).toBeNull();
    });

    it('should return null for invalid month-day "feb 30"', () => {
      const result = Completion.completeDate('feb 30');
      expect(result).toBeNull();
    });

    it('should return null for invalid month-day "32 jan"', () => {
      const result = Completion.completeDate('32 jan');
      expect(result).toBeNull();
    });

    it('should parse valid "15 jan" format', () => {
      const result = Completion.completeDate('15 jan');
      // Jan 15 is today, so it should roll to next year
      expect(result).toBe('2026-01-15');
    });

    it('should parse valid "february 28" format', () => {
      const result = Completion.completeDate('february 28');
      expect(result).toBe('2025-02-28');
    });
  });
});
