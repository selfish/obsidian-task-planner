import { TodoMatcher } from '../../src/core/matchers/todo-matcher';
import { TodoItem, TodoStatus } from '../../src/types/todo';
import { FileAdapter } from '../../src/types/file-adapter';

const createMockFileAdapter = (id: string, path: string): FileAdapter<unknown> => ({
  id,
  path,
  name: path.split('/').pop() || '',
  getContent: jest.fn().mockResolvedValue(''),
  setContent: jest.fn().mockResolvedValue(undefined),
  createOrSave: jest.fn().mockResolvedValue(undefined),
  isInFolder: jest.fn().mockReturnValue(false),
  file: {},
});

const createTodo = (text: string): TodoItem<unknown> => ({
  status: TodoStatus.Todo,
  text,
  file: createMockFileAdapter('file-1', 'notes/todo.md'),
  line: 1,
});

describe('TodoMatcher', () => {
  describe('exact match (default)', () => {
    it('should match when search term is found in todo text', () => {
      const matcher = new TodoMatcher('groceries');
      const todo = createTodo('Buy groceries from the store');
      expect(matcher.matches(todo)).toBe(true);
    });

    it('should not match when search term is not found', () => {
      const matcher = new TodoMatcher('homework');
      const todo = createTodo('Buy groceries from the store');
      expect(matcher.matches(todo)).toBe(false);
    });

    it('should match case-insensitively', () => {
      const matcher = new TodoMatcher('GROCERIES');
      const todo = createTodo('Buy groceries from the store');
      expect(matcher.matches(todo)).toBe(true);
    });

    it('should match partial words', () => {
      const matcher = new TodoMatcher('groc');
      const todo = createTodo('Buy groceries from the store');
      expect(matcher.matches(todo)).toBe(true);
    });

    it('should match all todos when search term is empty', () => {
      const matcher = new TodoMatcher('');
      const todo = createTodo('Any task');
      expect(matcher.matches(todo)).toBe(true);
    });

    it('should handle multi-word search terms with spaces removed', () => {
      const matcher = new TodoMatcher('buy groceries');
      const todo = createTodo('buygroceries and more');
      expect(matcher.matches(todo)).toBe(true);
    });
  });

  describe('fuzzy match', () => {
    it('should match when characters appear in order', () => {
      const matcher = new TodoMatcher('bgr', true);
      const todo = createTodo('Buy groceries');
      expect(matcher.matches(todo)).toBe(true);
    });

    it('should not match when characters are out of order', () => {
      const matcher = new TodoMatcher('rgb', true);
      const todo = createTodo('Buy groceries');
      expect(matcher.matches(todo)).toBe(false);
    });

    it('should match case-insensitively in fuzzy mode', () => {
      const matcher = new TodoMatcher('BGR', true);
      const todo = createTodo('Buy groceries');
      expect(matcher.matches(todo)).toBe(true);
    });

    it('should match when all characters are present in sequence', () => {
      const matcher = new TodoMatcher('bc', true);
      const todo = createTodo('abcd');
      expect(matcher.matches(todo)).toBe(true);
    });

    it('should not match when a character is missing', () => {
      const matcher = new TodoMatcher('xyz', true);
      const todo = createTodo('abcd');
      expect(matcher.matches(todo)).toBe(false);
    });

    it('should match empty search term to any todo', () => {
      const matcher = new TodoMatcher('', true);
      const todo = createTodo('Any task');
      expect(matcher.matches(todo)).toBe(true);
    });

    it('should handle consecutive matching characters', () => {
      const matcher = new TodoMatcher('abc', true);
      const todo = createTodo('abc');
      expect(matcher.matches(todo)).toBe(true);
    });

    it('should handle spaced out matching characters', () => {
      const matcher = new TodoMatcher('abc', true);
      const todo = createTodo('a---b---c');
      expect(matcher.matches(todo)).toBe(true);
    });
  });

  describe('bound matches method', () => {
    it('should work when used as a callback', () => {
      const matcher = new TodoMatcher('task');
      const todos = [
        createTodo('First task'),
        createTodo('Second item'),
        createTodo('Third task'),
      ];
      const filtered = todos.filter(matcher.matches);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].text).toBe('First task');
      expect(filtered[1].text).toBe('Third task');
    });
  });
});
