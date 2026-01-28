import { findTaskDate } from '../../src/utils/task-utils';
import { TaskItem, TaskStatus } from '../../src/types/task';
import { FileAdapter } from '../../src/types/file-adapter';

const createMockFile = (): FileAdapter<unknown> => ({
  id: 'test-file',
  path: 'test.md',
  name: 'test.md',
  getContent: jest.fn(),
  setContent: jest.fn(),
  createOrSave: jest.fn(),
  isInFolder: jest.fn(),
  file: {},
});

const createTodo = (attributes?: Record<string, string>): TaskItem<unknown> => ({
  status: TaskStatus.Todo,
  text: 'Test todo',
  file: createMockFile(),
  attributes,
});

describe('findTaskDate', () => {
  describe('with valid dates', () => {
    it('should find and parse a valid date attribute', () => {
      const todo = createTodo({ due: '2024-01-15' });

      const result = findTaskDate(todo, 'due');

      expect(result).not.toBeNull();
      expect(result!.format('YYYY-MM-DD')).toBe('2024-01-15');
    });

    it('should find scheduled date', () => {
      const todo = createTodo({ scheduled: '2024-06-20' });

      const result = findTaskDate(todo, 'scheduled');

      expect(result).not.toBeNull();
      expect(result!.format('YYYY-MM-DD')).toBe('2024-06-20');
    });

    it('should find start date', () => {
      const todo = createTodo({ start: '2024-03-01' });

      const result = findTaskDate(todo, 'start');

      expect(result).not.toBeNull();
      expect(result!.format('YYYY-MM-DD')).toBe('2024-03-01');
    });

    it('should parse dates with different formats', () => {
      const todo = createTodo({ due: '2024/12/25' });

      const result = findTaskDate(todo, 'due');

      expect(result).not.toBeNull();
      expect(result!.isValid()).toBe(true);
    });

    it('should handle ISO date format', () => {
      const todo = createTodo({ due: '2024-01-15T10:30:00' });

      const result = findTaskDate(todo, 'due');

      expect(result).not.toBeNull();
      expect(result!.isValid()).toBe(true);
    });
  });

  describe('with missing or invalid dates', () => {
    it('should return null when todo has no attributes', () => {
      const todo = createTodo(undefined);

      const result = findTaskDate(todo, 'due');

      expect(result).toBeNull();
    });

    it('should return null when attribute does not exist', () => {
      const todo = createTodo({ other: 'value' });

      const result = findTaskDate(todo, 'due');

      expect(result).toBeNull();
    });

    it('should return null for invalid date string', () => {
      const todo = createTodo({ due: 'not-a-date' });

      const result = findTaskDate(todo, 'due');

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const todo = createTodo({ due: '' });

      const result = findTaskDate(todo, 'due');

      expect(result).toBeNull();
    });

    it('should return null for gibberish', () => {
      const todo = createTodo({ due: 'xyz123abc' });

      const result = findTaskDate(todo, 'due');

      expect(result).toBeNull();
    });
  });

  describe('with different attribute names', () => {
    it('should work with custom attribute names', () => {
      const todo = createTodo({ myCustomDate: '2024-07-04' });

      const result = findTaskDate(todo, 'myCustomDate');

      expect(result).not.toBeNull();
      expect(result!.format('YYYY-MM-DD')).toBe('2024-07-04');
    });

    it('should be case-sensitive for attribute names', () => {
      const todo = createTodo({ Due: '2024-01-15' });

      const resultLower = findTaskDate(todo, 'due');
      const resultUpper = findTaskDate(todo, 'Due');

      expect(resultLower).toBeNull();
      expect(resultUpper).not.toBeNull();
    });
  });

  describe('with multiple attributes', () => {
    it('should find specific attribute among many', () => {
      const todo = createTodo({
        due: '2024-01-15',
        scheduled: '2024-01-10',
        start: '2024-01-05',
        priority: 'high',
      });

      expect(findTaskDate(todo, 'due')!.format('YYYY-MM-DD')).toBe('2024-01-15');
      expect(findTaskDate(todo, 'scheduled')!.format('YYYY-MM-DD')).toBe('2024-01-10');
      expect(findTaskDate(todo, 'start')!.format('YYYY-MM-DD')).toBe('2024-01-05');
      expect(findTaskDate(todo, 'priority')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle attributes with numeric-like values', () => {
      const todo = createTodo({ due: '20240115' });

      const result = findTaskDate(todo, 'due');

      // moment might parse this as a valid date
      expect(result).not.toBeNull();
    });

    it('should handle whitespace in date string', () => {
      const todo = createTodo({ due: '  2024-01-15  ' });

      const result = findTaskDate(todo, 'due');

      // moment handles whitespace
      expect(result).not.toBeNull();
    });
  });
});
