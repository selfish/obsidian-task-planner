import { FileTodoParser } from '../../src/core/parsers/file-todo-parser';
import { DEFAULT_SETTINGS } from '../../src/settings/types';
import { FileAdapter } from '../../src/types/file-adapter';
import { TodoParsingResult, TodoStatus } from '../../src/types/todo';

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

    it('should throw ParseError when file content cannot be read', async () => {
      const file: FileAdapter<unknown> = {
        id: 'file-1',
        path: 'notes/broken.md',
        name: 'broken.md',
        getContent: jest.fn().mockRejectedValue(new Error('File not found')),
        setContent: jest.fn().mockResolvedValue(undefined),
        createOrSave: jest.fn().mockResolvedValue(undefined),
        isInFolder: jest.fn().mockReturnValue(false),
        file: {},
      };

      await expect(parser.parseMdFile(file)).rejects.toThrow('Failed to read file content: notes/broken.md');
    });

    it('should include original error message in ParseError context', async () => {
      const file: FileAdapter<unknown> = {
        id: 'file-1',
        path: 'notes/error.md',
        name: 'error.md',
        getContent: jest.fn().mockRejectedValue(new Error('Permission denied')),
        setContent: jest.fn().mockResolvedValue(undefined),
        createOrSave: jest.fn().mockResolvedValue(undefined),
        isInFolder: jest.fn().mockReturnValue(false),
        file: {},
      };

      try {
        await parser.parseMdFile(file);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toHaveProperty('context.originalError', 'Permission denied');
        expect(error).toHaveProperty('filePath', 'notes/error.md');
      }
    });

    it('should handle non-Error thrown values when reading file', async () => {
      const file: FileAdapter<unknown> = {
        id: 'file-1',
        path: 'notes/string-error.md',
        name: 'string-error.md',
        getContent: jest.fn().mockRejectedValue('String error message'),
        setContent: jest.fn().mockResolvedValue(undefined),
        createOrSave: jest.fn().mockResolvedValue(undefined),
        isInFolder: jest.fn().mockReturnValue(false),
        file: {},
      };

      try {
        await parser.parseMdFile(file);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toHaveProperty('context.originalError', 'String error message');
      }
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

  describe('createTodoTreeStructure (internal)', () => {
    it('should skip whitespace-only lines in parsing results', () => {
      // This tests the defensive check on line 25 of file-todo-parser.ts
      // In normal operation, this code path is unreachable because todoParsingResults
      // only contains items where isTodo is true, which requires a non-empty checkbox line.
      // However, we test it directly to ensure the defensive code works correctly.
      const lines = ['- [ ] Task', '   ', '  - [ ] Subtask'];
      const parsingResults: TodoParsingResult<unknown>[] = [
        {
          lineNumber: 0,
          isTodo: true,
          indentLevel: 0,
          todo: { status: TodoStatus.Todo, text: 'Task', attributes: {}, tags: [], line: 0 },
        },
        {
          // Artificially create a parsing result pointing to a whitespace-only line
          lineNumber: 1,
          isTodo: true,
          indentLevel: 2,
          todo: { status: TodoStatus.Todo, text: '', attributes: {}, tags: [], line: 1 },
        },
        {
          lineNumber: 2,
          isTodo: true,
          indentLevel: 2,
          todo: { status: TodoStatus.Todo, text: 'Subtask', attributes: {}, tags: [], line: 2 },
        },
      ];

      // Access the private method for testing
      const createTodoTreeStructure = (parser as unknown as { createTodoTreeStructure: (lines: string[], results: TodoParsingResult<unknown>[]) => void }).createTodoTreeStructure.bind(parser);

      // Should not throw and should skip the whitespace line
      createTodoTreeStructure(lines, parsingResults);

      // The first task should have the subtask (from line 2), but not the whitespace entry
      expect(parsingResults[0].todo!.subtasks).toHaveLength(1);
      expect(parsingResults[0].todo!.subtasks![0].text).toBe('Subtask');
    });

    it('should skip parsing results where isTodo is false (not push to parent stack)', () => {
      // This tests the defensive check where current.isTodo is false
      // When isTodo is false, the item should not be pushed to the parent stack
      const lines = ['- [ ] Task', 'Regular text', '- [ ] Task2'];
      const parsingResults: TodoParsingResult<unknown>[] = [
        {
          lineNumber: 0,
          isTodo: true,
          indentLevel: 0,
          todo: { status: TodoStatus.Todo, text: 'Task', attributes: {}, tags: [], line: 0 },
        },
        {
          // Non-todo result (defensive case) - this should be skipped when deciding to push to parent stack
          lineNumber: 1,
          isTodo: false,
          indentLevel: 0,
        },
        {
          lineNumber: 2,
          isTodo: true,
          indentLevel: 0,
          todo: { status: TodoStatus.Todo, text: 'Task2', attributes: {}, tags: [], line: 2 },
        },
      ];

      const createTodoTreeStructure = (parser as unknown as { createTodoTreeStructure: (lines: string[], results: TodoParsingResult<unknown>[]) => void }).createTodoTreeStructure.bind(parser);

      // Should not throw and should handle isTodo=false results
      createTodoTreeStructure(lines, parsingResults);

      // Both tasks should be separate (no subtask relationship created through non-todo item)
      expect(parsingResults[0].todo!.subtasks).toBeUndefined();
      expect(parsingResults[2].todo!.subtasks).toBeUndefined();
    });

    it('should handle out-of-bounds line numbers gracefully', () => {
      // Test when lines[current.lineNumber] is undefined
      const lines = ['- [ ] Task'];
      const parsingResults: TodoParsingResult<unknown>[] = [
        {
          lineNumber: 0,
          isTodo: true,
          indentLevel: 0,
          todo: { status: TodoStatus.Todo, text: 'Task', attributes: {}, tags: [], line: 0 },
        },
        {
          // Line number beyond array bounds
          lineNumber: 999,
          isTodo: true,
          indentLevel: 0,
          todo: { status: TodoStatus.Todo, text: 'OutOfBounds', attributes: {}, tags: [], line: 999 },
        },
      ];

      const createTodoTreeStructure = (parser as unknown as { createTodoTreeStructure: (lines: string[], results: TodoParsingResult<unknown>[]) => void }).createTodoTreeStructure.bind(parser);

      // Should not throw when accessing undefined line
      createTodoTreeStructure(lines, parsingResults);
    });
  });

  describe('removeSubtasksFromTree (internal)', () => {
    it('should handle when subtask is not found in todos array', () => {
      // Access the private method for testing
      const removeSubtasksFromTree = (parser as unknown as { removeSubtasksFromTree: (todos: { subtasks?: unknown[] }[]) => void }).removeSubtasksFromTree.bind(parser);

      const subtask = { status: TodoStatus.Todo, text: 'Subtask', attributes: {}, tags: [], line: 1 };
      const todos = [
        {
          status: TodoStatus.Todo,
          text: 'Parent',
          attributes: {},
          tags: [],
          line: 0,
          // Subtask references an object that is NOT in the todos array
          subtasks: [subtask],
        },
      ];

      // The subtask is not in the todos array at top level, so idx will be -1
      // This tests the branch where idx < 0
      removeSubtasksFromTree(todos);

      // Parent should still exist
      expect(todos).toHaveLength(1);
    });
  });

  describe('parseMdFile edge cases', () => {
    it('should handle parsing result with isTodo true but todo undefined', async () => {
      // This is a defensive test for when result.todo might be falsy
      // We need to mock the statusOperations.toTodo to return isTodo=true but todo=undefined
      const content = '- [ ] Task';
      const file = createMockFileAdapter(content);

      // Create a parser with mocked internals
      const mockParser = new FileTodoParser(DEFAULT_SETTINGS);

      // Access statusOperations and mock toTodo
      const statusOperations = (mockParser as unknown as { statusOperations: { toTodo: jest.Mock } }).statusOperations;
      const originalToTodo = statusOperations.toTodo.bind(statusOperations);

      statusOperations.toTodo = jest.fn().mockImplementation((line: string, lineNumber: number) => {
        const result = originalToTodo(line, lineNumber);
        // For the first todo line, return isTodo=true but todo=undefined (defensive case)
        if (line.includes('Task')) {
          return {
            ...result,
            isTodo: true,
            todo: undefined,  // This is the defensive case we're testing
          };
        }
        return result;
      });

      const todos = await mockParser.parseMdFile(file);

      // Should not include the todo with undefined todo property
      expect(todos).toHaveLength(0);
    });
  });

});
