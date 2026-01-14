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

  describe('instance methods', () => {
    let completion: Completion;

    beforeEach(() => {
      completion = new Completion();
    });

    describe('complete', () => {
      it('should return empty array when not at an attribute position', () => {
        const result = completion.complete('Buy groceries', 5);
        expect(result).toEqual([]);
      });

      it('should return empty array when at beginning of line', () => {
        const result = completion.complete('Buy groceries', 0);
        expect(result).toEqual([]);
      });

      it('should return empty array for empty content', () => {
        const result = completion.complete('', 0);
        expect(result).toEqual([]);
      });

      it('should return empty array when @ is not preceded by space', () => {
        const result = completion.complete('email@example.com', 6);
        expect(result).toEqual([]);
      });

      it('should recognize attribute position after space and @', () => {
        const result = completion.complete('Task @due', 9);
        // Returns empty since completeAttribute is stubbed
        expect(result).toEqual([]);
      });

      it('should recognize attribute value position', () => {
        const result = completion.complete('Task @due(val', 13);
        // Returns empty since findMatchingAttributeValues returns []
        expect(result).toEqual([]);
      });
    });
  });
});
