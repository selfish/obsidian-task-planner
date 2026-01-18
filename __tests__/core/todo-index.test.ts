import { TodoIndex, TodoIndexDeps, TodoIndexSettings } from '../../src/core/index/todo-index';
import { FileTodoParser } from '../../src/core/parsers/file-todo-parser';
import { FolderTodoParser } from '../../src/core/parsers/folder-todo-parser';
import { FileAdapter } from '../../src/types/file-adapter';
import { TodoItem, TodoStatus } from '../../src/types/todo';
import { Logger } from '../../src/types/logger';
import { TodosInFiles } from '../../src/types/todos-in-files';

const createMockFileAdapter = (id: string, inArchive = false): FileAdapter<unknown> => ({
  id,
  path: `notes/${id}.md`,
  name: `${id}.md`,
  getContent: jest.fn().mockResolvedValue(''),
  setContent: jest.fn().mockResolvedValue(undefined),
  createOrSave: jest.fn().mockResolvedValue(undefined),
  isInFolder: jest.fn().mockImplementation((folder: string) => inArchive && folder === 'archive'),
  file: {},
});

const createMockLogger = (): Logger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createTodo = (text: string, file: FileAdapter<unknown>): TodoItem<unknown> => ({
  status: TodoStatus.Todo,
  text,
  file,
  line: 0,
});

describe('TodoIndex', () => {
  let mockLogger: Logger;
  let mockFileTodoParser: FileTodoParser<unknown>;
  let mockFolderTodoParser: FolderTodoParser<unknown>;
  let settings: TodoIndexSettings;
  let deps: TodoIndexDeps<unknown>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockFileTodoParser = {
      parseMdFile: jest.fn().mockResolvedValue([]),
    } as unknown as FileTodoParser<unknown>;
    mockFolderTodoParser = {
      parseFiles: jest.fn().mockResolvedValue([]),
    } as unknown as FolderTodoParser<unknown>;
    settings = {
      ignoreArchivedTodos: false,
      ignoredFolders: [],
    };
    deps = {
      fileTodoParser: mockFileTodoParser,
      folderTodoParser: mockFolderTodoParser,
      logger: mockLogger,
    };
  });

  describe('constructor', () => {
    it('should initialize with empty files array', () => {
      const index = new TodoIndex(deps, settings);
      expect(index.files).toEqual([]);
    });

    it('should have an onUpdateEvent', () => {
      const index = new TodoIndex(deps, settings);
      expect(index.onUpdateEvent).toBeDefined();
    });
  });

  describe('todos getter', () => {
    it('should return empty array when no files', () => {
      const index = new TodoIndex(deps, settings);
      expect(index.todos).toEqual([]);
    });

    it('should return all todos from all files', () => {
      const index = new TodoIndex(deps, settings);
      const file1 = createMockFileAdapter('file1');
      const file2 = createMockFileAdapter('file2');
      const todo1 = createTodo('Task 1', file1);
      const todo2 = createTodo('Task 2', file2);

      index.files = [
        { file: file1, todos: [todo1] },
        { file: file2, todos: [todo2] },
      ];

      expect(index.todos).toHaveLength(2);
      expect(index.todos).toContain(todo1);
      expect(index.todos).toContain(todo2);
    });
  });

  describe('filesLoaded', () => {
    it('should parse all files and update files array', async () => {
      const file1 = createMockFileAdapter('file1');
      const file2 = createMockFileAdapter('file2');
      const todo1 = createTodo('Task 1', file1);
      const todo2 = createTodo('Task 2', file2);

      const todosInFiles: TodosInFiles<unknown>[] = [
        { file: file1, todos: [todo1] },
        { file: file2, todos: [todo2] },
      ];

      (mockFolderTodoParser.parseFiles as jest.Mock).mockResolvedValue(todosInFiles);

      const index = new TodoIndex(deps, settings);
      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      index.filesLoaded([file1, file2]);

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(index.files).toEqual(todosInFiles);
      expect(updateHandler).toHaveBeenCalledWith([todo1, todo2]);
    });

    it('should filter out archived files when ignoreArchivedTodos is true', async () => {
      const settings: TodoIndexSettings = {
        ignoreArchivedTodos: true,
        ignoredFolders: ['archive'],
      };
      const index = new TodoIndex(deps, settings);

      const normalFile = createMockFileAdapter('normal', false);
      const archivedFile = createMockFileAdapter('archived', true);

      (mockFolderTodoParser.parseFiles as jest.Mock).mockResolvedValue([]);

      index.filesLoaded([normalFile, archivedFile]);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockFolderTodoParser.parseFiles).toHaveBeenCalledWith([normalFile]);
    });
  });

  describe('fileUpdated', () => {
    it('should re-parse the updated file', async () => {
      const file = createMockFileAdapter('file1');
      const oldTodo = createTodo('Old task', file);
      const newTodo = createTodo('New task', file);

      const index = new TodoIndex(deps, settings);
      index.files = [{ file, todos: [oldTodo] }];

      (mockFileTodoParser.parseMdFile as jest.Mock).mockResolvedValue([newTodo]);

      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      index.fileUpdated(file);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(index.files[0].todos).toEqual([newTodo]);
      expect(updateHandler).toHaveBeenCalled();
    });

    it('should ignore archived files when ignoreArchivedTodos is true', async () => {
      const settings: TodoIndexSettings = {
        ignoreArchivedTodos: true,
        ignoredFolders: ['archive'],
      };
      const index = new TodoIndex(deps, settings);
      const archivedFile = createMockFileAdapter('archived', true);

      index.fileUpdated(archivedFile);

      expect(mockFileTodoParser.parseMdFile).not.toHaveBeenCalled();
    });

    it('should log debug message', async () => {
      const file = createMockFileAdapter('file1');
      const index = new TodoIndex(deps, settings);
      index.files = [{ file, todos: [] }];

      (mockFileTodoParser.parseMdFile as jest.Mock).mockResolvedValue([]);

      index.fileUpdated(file);

      expect(mockLogger.debug).toHaveBeenCalledWith('TodoIndex: File updated: file1');
    });
  });

  describe('fileDeleted', () => {
    it('should remove the file from the index', async () => {
      const file1 = createMockFileAdapter('file1');
      const file2 = createMockFileAdapter('file2');

      const index = new TodoIndex(deps, settings);
      index.files = [
        { file: file1, todos: [] },
        { file: file2, todos: [] },
      ];

      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      index.fileDeleted(file1);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(index.files).toHaveLength(1);
      expect(index.files[0].file).toBe(file2);
      expect(updateHandler).toHaveBeenCalled();
    });

    it('should ignore archived files when ignoreArchivedTodos is true', () => {
      const settings: TodoIndexSettings = {
        ignoreArchivedTodos: true,
        ignoredFolders: ['archive'],
      };
      const index = new TodoIndex(deps, settings);
      const archivedFile = createMockFileAdapter('archived', true);
      index.files = [];

      // Should not throw when file is not in index
      index.fileDeleted(archivedFile);

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('ignored because archived'));
    });

    it('should throw error when file not found in index', async () => {
      const file = createMockFileAdapter('file1');
      const index = new TodoIndex(deps, settings);
      index.files = [];

      await expect(index.fileDeleted(file)).rejects.toThrow('TodoIndex: File not found in index: file1');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('fileCreated', () => {
    it('should add the new file to the index', async () => {
      const existingFile = createMockFileAdapter('existing');
      const newFile = createMockFileAdapter('new');
      const newTodo = createTodo('New task', newFile);

      const index = new TodoIndex(deps, settings);
      index.files = [{ file: existingFile, todos: [] }];

      (mockFileTodoParser.parseMdFile as jest.Mock).mockResolvedValue([newTodo]);

      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      await index.fileCreated(newFile);

      expect(index.files).toHaveLength(2);
      expect(index.files[1].file).toBe(newFile);
      expect(index.files[1].todos).toEqual([newTodo]);
      expect(updateHandler).toHaveBeenCalled();
    });

    it('should ignore archived files when ignoreArchivedTodos is true', () => {
      const settings: TodoIndexSettings = {
        ignoreArchivedTodos: true,
        ignoredFolders: ['archive'],
      };
      const index = new TodoIndex(deps, settings);
      const archivedFile = createMockFileAdapter('archived', true);

      index.fileCreated(archivedFile);

      expect(mockFileTodoParser.parseMdFile).not.toHaveBeenCalled();
    });
  });

  describe('fileRenamed', () => {
    it('should log debug message', () => {
      const file = createMockFileAdapter('newname');
      const index = new TodoIndex(deps, settings);

      index.fileRenamed('oldname', file);

      expect(mockLogger.debug).toHaveBeenCalledWith('TodoIndex: File renamed: oldname to newname');
    });
  });
});
