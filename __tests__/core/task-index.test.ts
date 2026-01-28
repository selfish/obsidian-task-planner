import { TaskIndex, TaskIndexDeps, TaskIndexSettings } from '../../src/core/index/task-index';
import { FileTaskParser } from '../../src/core/parsers/file-task-parser';
import { FolderTaskParser } from '../../src/core/parsers/folder-task-parser';
import { FileAdapter } from '../../src/types/file-adapter';
import { TaskItem, TaskStatus } from '../../src/types/task';
import { Logger } from '../../src/types/logger';
import { TasksInFiles } from '../../src/types/tasks-in-files';

const createMockFileAdapter = (id: string, inArchive = false, shouldIgnore = false): FileAdapter<unknown> => ({
  id,
  path: `notes/${id}.md`,
  name: `${id}.md`,
  getContent: jest.fn().mockResolvedValue(''),
  setContent: jest.fn().mockResolvedValue(undefined),
  createOrSave: jest.fn().mockResolvedValue(undefined),
  isInFolder: jest.fn().mockImplementation((folder: string) => inArchive && folder === 'archive'),
  shouldIgnore: jest.fn().mockReturnValue(shouldIgnore),
  file: {},
});

const createMockLogger = (): Logger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createTodo = (text: string, file: FileAdapter<unknown>): TaskItem<unknown> => ({
  status: TaskStatus.Todo,
  text,
  file,
  line: 0,
});

describe('TaskIndex', () => {
  let mockLogger: Logger;
  let mockFileTodoParser: FileTaskParser<unknown>;
  let mockFolderTodoParser: FolderTaskParser<unknown>;
  let settings: TaskIndexSettings;
  let deps: TaskIndexDeps<unknown>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockFileTodoParser = {
      parseMdFile: jest.fn().mockResolvedValue([]),
    } as unknown as FileTaskParser<unknown>;
    mockFolderTodoParser = {
      parseFiles: jest.fn().mockResolvedValue([]),
    } as unknown as FolderTaskParser<unknown>;
    settings = {
      ignoreArchivedTasks: false,
      ignoredFolders: [],
    };
    deps = {
      fileTaskParser: mockFileTodoParser,
      folderTaskParser: mockFolderTodoParser,
      logger: mockLogger,
    };
  });

  describe('constructor', () => {
    it('should initialize with empty files array', () => {
      const index = new TaskIndex(deps, settings);
      expect(index.files).toEqual([]);
    });

    it('should have an onUpdateEvent', () => {
      const index = new TaskIndex(deps, settings);
      expect(index.onUpdateEvent).toBeDefined();
    });
  });

  describe('todos getter', () => {
    it('should return empty array when no files', () => {
      const index = new TaskIndex(deps, settings);
      expect(index.tasks).toEqual([]);
    });

    it('should return all todos from all files', () => {
      const index = new TaskIndex(deps, settings);
      const file1 = createMockFileAdapter('file1');
      const file2 = createMockFileAdapter('file2');
      const todo1 = createTodo('Task 1', file1);
      const todo2 = createTodo('Task 2', file2);

      index.files = [
        { file: file1, tasks: [todo1] },
        { file: file2, tasks: [todo2] },
      ];

      expect(index.tasks).toHaveLength(2);
      expect(index.tasks).toContain(todo1);
      expect(index.tasks).toContain(todo2);
    });
  });

  describe('filesLoaded', () => {
    it('should parse all files and update files array', async () => {
      const file1 = createMockFileAdapter('file1');
      const file2 = createMockFileAdapter('file2');
      const todo1 = createTodo('Task 1', file1);
      const todo2 = createTodo('Task 2', file2);

      const todosInFiles: TasksInFiles<unknown>[] = [
        { file: file1, tasks: [todo1] },
        { file: file2, tasks: [todo2] },
      ];

      (mockFolderTodoParser.parseFiles as jest.Mock).mockResolvedValue(todosInFiles);

      const index = new TaskIndex(deps, settings);
      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      index.filesLoaded([file1, file2]);

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(index.files).toEqual(todosInFiles);
      expect(updateHandler).toHaveBeenCalledWith([todo1, todo2]);
    });

    it('should filter out archived files when ignoreArchivedTasks is true', async () => {
      const settings: TaskIndexSettings = {
        ignoreArchivedTasks: true,
        ignoredFolders: ['archive'],
      };
      const index = new TaskIndex(deps, settings);

      const normalFile = createMockFileAdapter('normal', false);
      const archivedFile = createMockFileAdapter('archived', true);

      (mockFolderTodoParser.parseFiles as jest.Mock).mockResolvedValue([]);

      index.filesLoaded([normalFile, archivedFile]);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockFolderTodoParser.parseFiles).toHaveBeenCalledWith([normalFile]);
    });

    it('should log error when parsing files fails', async () => {
      const file = createMockFileAdapter('file1');
      const parseError = new Error('Parse error');

      (mockFolderTodoParser.parseFiles as jest.Mock).mockRejectedValue(parseError);

      const index = new TaskIndex(deps, settings);

      await index.filesLoaded([file]);

      expect(mockLogger.error).toHaveBeenCalledWith(`Failed to load files: ${parseError}`);
    });
  });

  describe('fileUpdated', () => {
    it('should re-parse the updated file', async () => {
      const file = createMockFileAdapter('file1');
      const oldTodo = createTodo('Old task', file);
      const newTodo = createTodo('New task', file);

      const index = new TaskIndex(deps, settings);
      index.files = [{ file, todos: [oldTodo] }];

      (mockFileTodoParser.parseMdFile as jest.Mock).mockResolvedValue([newTodo]);

      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      index.fileUpdated(file);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(index.files[0].tasks).toEqual([newTodo]);
      expect(updateHandler).toHaveBeenCalled();
    });

    it('should ignore archived files when ignoreArchivedTasks is true', async () => {
      const settings: TaskIndexSettings = {
        ignoreArchivedTasks: true,
        ignoredFolders: ['archive'],
      };
      const index = new TaskIndex(deps, settings);
      const archivedFile = createMockFileAdapter('archived', true);

      index.fileUpdated(archivedFile);

      expect(mockFileTodoParser.parseMdFile).not.toHaveBeenCalled();
    });

    it('should remove file from index when moved to archived folder', async () => {
      const settings: TaskIndexSettings = {
        ignoreArchivedTasks: true,
        ignoredFolders: ['archive'],
      };
      const index = new TaskIndex(deps, settings);

      // File starts as non-archived and is in the index
      const file = createMockFileAdapter('file1', false);
      const todo = createTodo('Task 1', file);
      index.files = [{ file, todos: [todo] }];

      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      // Now the file is in an archived folder
      (file.isInFolder as jest.Mock).mockReturnValue(true);

      await index.fileUpdated(file);

      expect(index.files).toHaveLength(0);
      expect(updateHandler).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('TaskIndex: File now ignored, removing from index: file1');
    });

    it('should log debug message', async () => {
      const file = createMockFileAdapter('file1');
      const index = new TaskIndex(deps, settings);
      index.files = [{ file, todos: [] }];

      (mockFileTodoParser.parseMdFile as jest.Mock).mockResolvedValue([]);

      index.fileUpdated(file);

      expect(mockLogger.debug).toHaveBeenCalledWith('TaskIndex: File updated: file1');
    });

    it('should log error when parsing file fails', async () => {
      const file = createMockFileAdapter('file1');
      const parseError = new Error('Parse error');
      const index = new TaskIndex(deps, settings);
      index.files = [{ file, todos: [] }];

      (mockFileTodoParser.parseMdFile as jest.Mock).mockRejectedValue(parseError);

      await index.fileUpdated(file);

      expect(mockLogger.error).toHaveBeenCalledWith(`Failed to update file file1: ${parseError}`);
    });
  });

  describe('fileDeleted', () => {
    it('should remove the file from the index', async () => {
      const file1 = createMockFileAdapter('file1');
      const file2 = createMockFileAdapter('file2');

      const index = new TaskIndex(deps, settings);
      index.files = [
        { file: file1, tasks: [] },
        { file: file2, tasks: [] },
      ];

      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      index.fileDeleted(file1);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(index.files).toHaveLength(1);
      expect(index.files[0].file).toBe(file2);
      expect(updateHandler).toHaveBeenCalled();
    });

    it('should ignore archived files when ignoreArchivedTasks is true', () => {
      const settings: TaskIndexSettings = {
        ignoreArchivedTasks: true,
        ignoredFolders: ['archive'],
      };
      const index = new TaskIndex(deps, settings);
      const archivedFile = createMockFileAdapter('archived', true);
      index.files = [];

      // Should not throw when file is not in index
      index.fileDeleted(archivedFile);

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('ignored because archived'));
    });

    it('should throw error when file not found in index', async () => {
      const file = createMockFileAdapter('file1');
      const index = new TaskIndex(deps, settings);
      index.files = [];

      await expect(index.fileDeleted(file)).rejects.toThrow('TaskIndex: File not found in index: file1');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('fileCreated', () => {
    it('should add the new file to the index', async () => {
      const existingFile = createMockFileAdapter('existing');
      const newFile = createMockFileAdapter('new');
      const newTodo = createTodo('New task', newFile);

      const index = new TaskIndex(deps, settings);
      index.files = [{ file: existingFile, tasks: [] }];

      (mockFileTodoParser.parseMdFile as jest.Mock).mockResolvedValue([newTodo]);

      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      await index.fileCreated(newFile);

      expect(index.files).toHaveLength(2);
      expect(index.files[1].file).toBe(newFile);
      expect(index.files[1].tasks).toEqual([newTodo]);
      expect(updateHandler).toHaveBeenCalled();
    });

    it('should ignore archived files when ignoreArchivedTasks is true', () => {
      const settings: TaskIndexSettings = {
        ignoreArchivedTasks: true,
        ignoredFolders: ['archive'],
      };
      const index = new TaskIndex(deps, settings);
      const archivedFile = createMockFileAdapter('archived', true);

      index.fileCreated(archivedFile);

      expect(mockFileTodoParser.parseMdFile).not.toHaveBeenCalled();
    });

    it('should log error when parsing created file fails', async () => {
      const newFile = createMockFileAdapter('new');
      const parseError = new Error('Parse error');
      const index = new TaskIndex(deps, settings);
      index.files = [];

      (mockFileTodoParser.parseMdFile as jest.Mock).mockRejectedValue(parseError);

      await index.fileCreated(newFile);

      expect(mockLogger.error).toHaveBeenCalledWith(`Failed to parse created file new: ${parseError}`);
    });
  });

  describe('fileRenamed', () => {
    it('should log debug message', () => {
      const file = createMockFileAdapter('newname');
      const index = new TaskIndex(deps, settings);

      index.fileRenamed('oldname', file);

      expect(mockLogger.debug).toHaveBeenCalledWith('TaskIndex: File renamed: oldname to newname');
    });

    it('should return early when file not found in index', async () => {
      const file = createMockFileAdapter('newname');
      const index = new TaskIndex(deps, settings);
      index.files = [];

      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      await index.fileRenamed('nonexistent', file);

      expect(mockLogger.debug).toHaveBeenCalledWith('TaskIndex: File not found in index during rename: nonexistent');
      expect(updateHandler).not.toHaveBeenCalled();
    });

    it('should update file reference when file is renamed', async () => {
      const oldFile = createMockFileAdapter('oldname');
      const newFile = createMockFileAdapter('newname');
      const todo = createTodo('Task 1', oldFile);

      const index = new TaskIndex(deps, settings);
      index.files = [{ file: oldFile, tasks: [todo] }];

      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      await index.fileRenamed('oldname', newFile);

      expect(index.files).toHaveLength(1);
      expect(index.files[0].file).toBe(newFile);
      expect(updateHandler).toHaveBeenCalled();
    });

    it('should remove file from index when renamed/moved to ignored folder', async () => {
      const settings: TaskIndexSettings = {
        ignoreArchivedTasks: true,
        ignoredFolders: ['archive'],
      };
      const index = new TaskIndex(deps, settings);

      const originalFile = createMockFileAdapter('original');
      const archivedFile = createMockFileAdapter('archived', true);
      const todo = createTodo('Task 1', originalFile);

      index.files = [{ file: originalFile, tasks: [todo] }];

      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      await index.fileRenamed('original', archivedFile);

      expect(index.files).toHaveLength(0);
      expect(updateHandler).toHaveBeenCalled();
    });

    it('should invalidate cache when file is renamed', async () => {
      const oldFile = createMockFileAdapter('oldname');
      const newFile = createMockFileAdapter('newname');
      const todo = createTodo('Task 1', oldFile);

      const index = new TaskIndex(deps, settings);
      index.files = [{ file: oldFile, tasks: [todo] }];

      // Access todos to populate the cache
      expect(index.tasks).toHaveLength(1);

      await index.fileRenamed('oldname', newFile);

      // The todos getter should return fresh data (cache invalidated)
      expect(index.tasks).toHaveLength(1);
    });
  });

  describe('triggerUpdate error handling', () => {
    it('should log error when update event listener throws', async () => {
      const file = createMockFileAdapter('file1');
      const todo = createTodo('Task 1', file);
      const listenerError = new Error('Listener error');

      const index = new TaskIndex(deps, settings);
      index.files = [{ file, todos: [todo] }];

      // Add a listener that throws an error
      index.onUpdateEvent.listen(() => {
        throw listenerError;
      });

      (mockFileTodoParser.parseMdFile as jest.Mock).mockResolvedValue([todo]);

      await index.fileUpdated(file);

      expect(mockLogger.error).toHaveBeenCalledWith(`Failed to trigger update event: ${listenerError}`);
    });
  });

  describe('frontmatter ignore (shouldIgnore)', () => {
    // Note: Frontmatter-based ignore (shouldIgnore) is now handled at display level,
    // not at index level. This allows "show ignored" mode to display those tasks.
    // Files with shouldIgnore are still included in the index.

    it('should include files with shouldIgnore returning true during filesLoaded', async () => {
      const normalFile = createMockFileAdapter('normal', false, false);
      const ignoredFile = createMockFileAdapter('ignored', false, true);

      (mockFolderTodoParser.parseFiles as jest.Mock).mockResolvedValue([]);

      const index = new TaskIndex(deps, settings);
      await index.filesLoaded([normalFile, ignoredFile]);

      // Both files should be passed to parser (shouldIgnore is handled at display level)
      expect(mockFolderTodoParser.parseFiles).toHaveBeenCalledWith([normalFile, ignoredFile]);
    });

    it('should include files with shouldIgnore returning true during fileCreated', async () => {
      const ignoredFile = createMockFileAdapter('ignored', false, true);
      const todo = createTodo('Task 1', ignoredFile);
      (mockFileTodoParser.parseMdFile as jest.Mock).mockResolvedValue([todo]);

      const index = new TaskIndex(deps, settings);
      await index.fileCreated(ignoredFile);

      // File should be parsed and added (shouldIgnore is handled at display level)
      expect(mockFileTodoParser.parseMdFile).toHaveBeenCalledWith(ignoredFile);
      expect(index.files).toHaveLength(1);
    });

    it('should keep file in index when frontmatter ignore is added during fileUpdated', async () => {
      const file = createMockFileAdapter('file1', false, false);
      const todo = createTodo('Task 1', file);

      const index = new TaskIndex(deps, settings);
      index.files = [{ file, todos: [todo] }];

      // Simulate frontmatter change - shouldIgnore now returns true
      (file.shouldIgnore as jest.Mock).mockReturnValue(true);
      (mockFileTodoParser.parseMdFile as jest.Mock).mockResolvedValue([todo]);

      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      await index.fileUpdated(file);

      // File should still be in index (shouldIgnore is handled at display level)
      expect(index.files).toHaveLength(1);
      expect(updateHandler).toHaveBeenCalled();
    });

    it('should add file to index when frontmatter ignore is removed during fileUpdated', async () => {
      const file = createMockFileAdapter('file1', false, false);
      const todo = createTodo('Task 1', file);

      (mockFileTodoParser.parseMdFile as jest.Mock).mockResolvedValue([todo]);

      const index = new TaskIndex(deps, settings);
      // File is not in index (was previously ignored)
      index.files = [];

      const updateHandler = jest.fn().mockResolvedValue(undefined);
      index.onUpdateEvent.listen(updateHandler);

      await index.fileUpdated(file);

      expect(index.files).toHaveLength(1);
      expect(index.files[0].tasks).toEqual([todo]);
      expect(updateHandler).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('TaskIndex: File no longer ignored, adding to index: file1');
    });

    it('should log error when parsing previously ignored file fails during fileUpdated', async () => {
      const file = createMockFileAdapter('file1', false, false);
      const parseError = new Error('Parse error');

      (mockFileTodoParser.parseMdFile as jest.Mock).mockRejectedValue(parseError);

      const index = new TaskIndex(deps, settings);
      // File is not in index (was previously ignored)
      index.files = [];

      await index.fileUpdated(file);

      expect(mockLogger.error).toHaveBeenCalledWith(`Failed to add previously ignored file file1: ${parseError}`);
      expect(index.files).toHaveLength(0);
    });

    it('should handle file without shouldIgnore method', async () => {
      // Create a file adapter without shouldIgnore defined
      const fileWithoutShouldIgnore: FileAdapter<unknown> = {
        id: 'noignore',
        path: 'notes/noignore.md',
        name: 'noignore.md',
        getContent: jest.fn().mockResolvedValue(''),
        setContent: jest.fn().mockResolvedValue(undefined),
        createOrSave: jest.fn().mockResolvedValue(undefined),
        isInFolder: jest.fn().mockReturnValue(false),
        // shouldIgnore is undefined
        file: {},
      };

      (mockFolderTodoParser.parseFiles as jest.Mock).mockResolvedValue([]);

      const index = new TaskIndex(deps, settings);
      await index.filesLoaded([fileWithoutShouldIgnore]);

      // File should be included (not ignored) when shouldIgnore is undefined
      expect(mockFolderTodoParser.parseFiles).toHaveBeenCalledWith([fileWithoutShouldIgnore]);
    });
  });
});
