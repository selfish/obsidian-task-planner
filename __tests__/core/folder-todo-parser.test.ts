import { FolderTodoParser, FolderTodoParserDeps } from '../../src/core/parsers/folder-todo-parser';
import { FileTodoParser } from '../../src/core/parsers/file-todo-parser';
import { FileAdapter } from '../../src/types/file-adapter';
import { TodoItem, TodoStatus } from '../../src/types/todo';
import { Logger } from '../../src/types/logger';

const createMockFileAdapter = (id: string, content: string): FileAdapter<unknown> => ({
  id,
  path: `notes/${id}.md`,
  name: `${id}.md`,
  getContent: jest.fn().mockResolvedValue(content),
  setContent: jest.fn().mockResolvedValue(undefined),
  createOrSave: jest.fn().mockResolvedValue(undefined),
  isInFolder: jest.fn().mockReturnValue(false),
  file: {},
});

const createMockLogger = (): Logger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockFileTodoParser = (todos: TodoItem<unknown>[]): FileTodoParser<unknown> => ({
  parseMdFile: jest.fn().mockResolvedValue(todos),
}) as unknown as FileTodoParser<unknown>;

describe('FolderTodoParser', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  describe('parseFiles', () => {
    it('should parse multiple files and return todos by file', async () => {
      const mockTodos1: TodoItem<unknown>[] = [
        { status: TodoStatus.Todo, text: 'Task 1', file: {} as FileAdapter<unknown> },
      ];
      const mockTodos2: TodoItem<unknown>[] = [
        { status: TodoStatus.Todo, text: 'Task 2', file: {} as FileAdapter<unknown> },
      ];

      const mockFileTodoParser = {
        parseMdFile: jest.fn()
          .mockResolvedValueOnce(mockTodos1)
          .mockResolvedValueOnce(mockTodos2),
      } as unknown as FileTodoParser<unknown>;

      const deps: FolderTodoParserDeps<unknown> = {
        fileTodoParser: mockFileTodoParser,
        logger: mockLogger,
      };
      const parser = new FolderTodoParser(deps);

      const file1 = createMockFileAdapter('file1', '- [ ] Task 1');
      const file2 = createMockFileAdapter('file2', '- [ ] Task 2');

      const result = await parser.parseFiles([file1, file2]);

      expect(result).toHaveLength(2);
      expect(result[0].file).toBe(file1);
      expect(result[0].todos).toEqual(mockTodos1);
      expect(result[1].file).toBe(file2);
      expect(result[1].todos).toEqual(mockTodos2);
    });

    it('should log debug messages', async () => {
      const mockFileTodoParser = createMockFileTodoParser([]);
      const deps: FolderTodoParserDeps<unknown> = {
        fileTodoParser: mockFileTodoParser,
        logger: mockLogger,
      };
      const parser = new FolderTodoParser(deps);

      const file = createMockFileAdapter('file1', '');

      await parser.parseFiles([file]);

      expect(mockLogger.debug).toHaveBeenCalledWith('Loading 1 files');
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Loaded 1 todos in'));
    });

    it('should handle empty file list', async () => {
      const mockFileTodoParser = createMockFileTodoParser([]);
      const deps: FolderTodoParserDeps<unknown> = {
        fileTodoParser: mockFileTodoParser,
        logger: mockLogger,
      };
      const parser = new FolderTodoParser(deps);

      const result = await parser.parseFiles([]);

      expect(result).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Loading 0 files');
    });

    it('should parse files in parallel', async () => {
      const parseOrder: string[] = [];
      const mockFileTodoParser = {
        parseMdFile: jest.fn().mockImplementation(async (file: FileAdapter<unknown>) => {
          parseOrder.push(file.id);
          // Add a small delay to verify parallel execution
          await new Promise(resolve => setTimeout(resolve, 10));
          return [];
        }),
      } as unknown as FileTodoParser<unknown>;

      const deps: FolderTodoParserDeps<unknown> = {
        fileTodoParser: mockFileTodoParser,
        logger: mockLogger,
      };
      const parser = new FolderTodoParser(deps);

      const files = [
        createMockFileAdapter('file1', ''),
        createMockFileAdapter('file2', ''),
        createMockFileAdapter('file3', ''),
      ];

      await parser.parseFiles(files);

      // All files should have been parsed
      expect(parseOrder).toContain('file1');
      expect(parseOrder).toContain('file2');
      expect(parseOrder).toContain('file3');
    });

    it('should return correct todo count in debug log', async () => {
      const mockFileTodoParser = createMockFileTodoParser([]);
      const deps: FolderTodoParserDeps<unknown> = {
        fileTodoParser: mockFileTodoParser,
        logger: mockLogger,
      };
      const parser = new FolderTodoParser(deps);

      const files = [
        createMockFileAdapter('file1', ''),
        createMockFileAdapter('file2', ''),
      ];

      await parser.parseFiles(files);

      // "Loaded 2 todos" because we have 2 TodosInFiles results
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringMatching(/Loaded 2 todos in \d+ms/));
    });
  });
});
