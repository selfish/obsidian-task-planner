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
});
