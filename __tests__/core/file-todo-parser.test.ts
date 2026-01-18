import { FileTodoParser } from '../../src/core/parsers/file-todo-parser';
import { DEFAULT_SETTINGS } from '../../src/settings/types';
import { FileAdapter } from '../../src/types/file-adapter';
import { TodoStatus } from '../../src/types/todo';

const createMockFileAdapter = (content: string): FileAdapter<unknown> => ({
  id: 'file-1',
  path: 'notes/todo.md',
  name: 'todo.md',
  getContent: jest.fn().mockResolvedValue(content),
  setContent: jest.fn().mockResolvedValue(undefined),
  createOrSave: jest.fn().mockResolvedValue(undefined),
  isInFolder: jest.fn().mockReturnValue(false),
  file: {},
});

describe('FileTodoParser', () => {
  let parser: FileTodoParser<unknown>;

  beforeEach(() => {
    parser = new FileTodoParser(DEFAULT_SETTINGS);
  });

  describe('parseMdFile', () => {
    it('should parse a simple todo file', async () => {
      const content = '- [ ] Task one\n- [ ] Task two\n- [ ] Task three';
      const file = createMockFileAdapter(content);

      const todos = await parser.parseMdFile(file);

      expect(todos).toHaveLength(3);
      expect(todos[0].text).toBe('Task one');
      expect(todos[1].text).toBe('Task two');
      expect(todos[2].text).toBe('Task three');
    });

    it('should set correct line numbers', async () => {
      const content = '- [ ] Task one\n- [ ] Task two\n- [ ] Task three';
      const file = createMockFileAdapter(content);

      const todos = await parser.parseMdFile(file);

      expect(todos[0].line).toBe(0);
      expect(todos[1].line).toBe(1);
      expect(todos[2].line).toBe(2);
    });

    it('should set file reference on todos', async () => {
      const content = '- [ ] Task';
      const file = createMockFileAdapter(content);

      const todos = await parser.parseMdFile(file);

      expect(todos[0].file).toBe(file);
    });

    it('should parse different status types', async () => {
      const content = '- [ ] Todo\n- [x] Completed\n- [>] In Progress\n- [-] Canceled';
      const file = createMockFileAdapter(content);

      const todos = await parser.parseMdFile(file);

      expect(todos[0].status).toBe(TodoStatus.Todo);
      expect(todos[1].status).toBe(TodoStatus.Complete);
      expect(todos[2].status).toBe(TodoStatus.InProgress);
      expect(todos[3].status).toBe(TodoStatus.Canceled);
    });

    it('should ignore non-todo lines', async () => {
      const content = 'Regular text\n- [ ] Task\n- Plain list item\nMore text';
      const file = createMockFileAdapter(content);

      const todos = await parser.parseMdFile(file);

      expect(todos).toHaveLength(1);
      expect(todos[0].text).toBe('Task');
    });

    it('should parse todos with attributes', async () => {
      const content = '- [ ] Task [due:: 2025-01-15] [priority:: high]';
      const file = createMockFileAdapter(content);

      const todos = await parser.parseMdFile(file);

      expect(todos[0].attributes).toEqual({
        due: '2025-01-15',
        priority: 'high',
      });
    });

    it('should handle empty file', async () => {
      const file = createMockFileAdapter('');

      const todos = await parser.parseMdFile(file);

      expect(todos).toHaveLength(0);
    });

    it('should handle file with only blank lines', async () => {
      const file = createMockFileAdapter('\n\n\n');

      const todos = await parser.parseMdFile(file);

      expect(todos).toHaveLength(0);
    });
  });

  describe('subtask tree structure', () => {
    it('should create parent-child relationship based on indentation', async () => {
      const content = '- [ ] Parent task\n  - [ ] Child task';
      const file = createMockFileAdapter(content);

      const todos = await parser.parseMdFile(file);

      // Only parent should be in top-level list
      expect(todos).toHaveLength(1);
      expect(todos[0].text).toBe('Parent task');
      expect(todos[0].subtasks).toHaveLength(1);
      expect(todos[0].subtasks![0].text).toBe('Child task');
    });

    it('should handle multiple levels of nesting', async () => {
      const content = '- [ ] Level 1\n  - [ ] Level 2\n    - [ ] Level 3';
      const file = createMockFileAdapter(content);

      const todos = await parser.parseMdFile(file);

      expect(todos).toHaveLength(1);
      expect(todos[0].subtasks).toHaveLength(1);
      expect(todos[0].subtasks![0].subtasks).toHaveLength(1);
      expect(todos[0].subtasks![0].subtasks![0].text).toBe('Level 3');
    });

    it('should handle multiple children at same level', async () => {
      const content = '- [ ] Parent\n  - [ ] Child 1\n  - [ ] Child 2\n  - [ ] Child 3';
      const file = createMockFileAdapter(content);

      const todos = await parser.parseMdFile(file);

      expect(todos).toHaveLength(1);
      expect(todos[0].subtasks).toHaveLength(3);
    });

    it('should handle siblings after nested children', async () => {
      const content = '- [ ] Parent 1\n  - [ ] Child 1\n- [ ] Parent 2';
      const file = createMockFileAdapter(content);

      const todos = await parser.parseMdFile(file);

      expect(todos).toHaveLength(2);
      expect(todos[0].text).toBe('Parent 1');
      expect(todos[0].subtasks).toHaveLength(1);
      expect(todos[1].text).toBe('Parent 2');
    });

    it('should skip empty lines when building tree', async () => {
      const content = '- [ ] Parent\n\n  - [ ] Child';
      const file = createMockFileAdapter(content);

      const todos = await parser.parseMdFile(file);

      expect(todos).toHaveLength(1);
      expect(todos[0].subtasks).toHaveLength(1);
    });

    it('should handle complex nested structure', async () => {
      const content = [
        '- [ ] Task A',
        '  - [ ] Subtask A1',
        '    - [ ] Subtask A1a',
        '  - [ ] Subtask A2',
        '- [ ] Task B',
        '  - [ ] Subtask B1',
      ].join('\n');
      const file = createMockFileAdapter(content);

      const todos = await parser.parseMdFile(file);

      expect(todos).toHaveLength(2);
      expect(todos[0].text).toBe('Task A');
      expect(todos[0].subtasks).toHaveLength(2);
      expect(todos[0].subtasks![0].subtasks).toHaveLength(1);
      expect(todos[1].text).toBe('Task B');
      expect(todos[1].subtasks).toHaveLength(1);
    });

    it('should handle tab indentation', async () => {
      const content = '- [ ] Parent\n\t- [ ] Child';
      const file = createMockFileAdapter(content);

      const todos = await parser.parseMdFile(file);

      expect(todos).toHaveLength(1);
      expect(todos[0].subtasks).toHaveLength(1);
    });
  });

});
