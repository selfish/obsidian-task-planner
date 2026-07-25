import { UndoableFileOperations } from '../../src/core/operations/undoable-file-ops';
import { UndoManager, UndoOperation } from '../../src/core/operations/undo-manager';
import { TaskItem, TaskStatus } from '../../src/types/task';
import { FileAdapter } from '../../src/types/file-adapter';
import { TaskPlannerSettings, DEFAULT_SETTINGS } from '../../src/settings/types';

// Mock FileOperations
jest.mock('../../src/core/operations/file-operations', () => {
  return {
    FileOperations: jest.fn().mockImplementation(() => ({
      refreshTasks: jest.fn().mockResolvedValue(undefined),
      updateAttribute: jest.fn().mockResolvedValue(undefined),
      removeAttribute: jest.fn().mockResolvedValue(undefined),
      updateTaskStatus: jest.fn().mockResolvedValue(undefined),
      appendTag: jest.fn().mockResolvedValue(undefined),
      removeTag: jest.fn().mockResolvedValue(undefined),
      batchUpdateAttribute: jest.fn().mockResolvedValue(undefined),
      batchRemoveAttribute: jest.fn().mockResolvedValue(undefined),
      batchUpdateTaskStatus: jest.fn().mockResolvedValue(undefined),
      batchAppendTag: jest.fn().mockResolvedValue(undefined),
      batchRemoveTag: jest.fn().mockResolvedValue(undefined),
      batchMove: jest.fn().mockResolvedValue(undefined),
      batchApplyMutations: jest.fn().mockImplementation(async (mutations) => {
        for (const mutation of mutations) if (mutation.status !== undefined) mutation.task.status = mutation.status;
      }),
      lineParser: { hasTag: jest.fn().mockReturnValue(true) },
      hasSourceLineAt: jest.fn().mockResolvedValue(true),
    })),
  };
});

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

const createTodo = (
  id: string,
  text: string,
  line: number = 1,
  attributes: Record<string, unknown> = {},
  tags: string[] = [],
  status: TaskStatus = TaskStatus.Todo
): TaskItem<unknown> => ({
  status,
  text,
  file: createMockFileAdapter(`file-${id}`, `notes/${id}.md`),
  line,
  attributes,
  tags,
});

describe('UndoableFileOperations', () => {
  let undoableOps: UndoableFileOperations;
  let undoManager: UndoManager;
  let settings: TaskPlannerSettings;

  beforeEach(() => {
    jest.clearAllMocks();
    undoManager = new UndoManager({ enabled: true, maxHistorySize: 10 });
    settings = { ...DEFAULT_SETTINGS };
    undoableOps = new UndoableFileOperations({ settings, undoManager });
  });

  describe('updateAttributeWithUndo', () => {
    it('should update attribute and record operation', async () => {
      const todo = createTodo('1', 'Test task');

      await undoableOps.updateAttributeWithUndo(todo, 'due', '2025-01-15', 'Moved task to Tomorrow');

      expect(undoManager.getHistorySize()).toBe(1);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.description).toBe('Moved task to Tomorrow');
      expect(lastOp?.taskChanges).toHaveLength(1);
      expect(lastOp?.taskChanges[0].attributeName).toBe('due');
      expect(lastOp?.taskChanges[0].newValue).toBe('2025-01-15');
    });

    it('should capture previous value', async () => {
      const todo = createTodo('1', 'Test task', 1, { due: '2025-01-10' });

      await undoableOps.updateAttributeWithUndo(todo, 'due', '2025-01-15', 'Rescheduled');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.taskChanges[0].previousValue).toBe('2025-01-10');
    });

    it('records the refreshed line identity for undo', async () => {
      const todo = createTodo('1', 'Test task', 1);
      const fileOperations = (undoableOps as unknown as { fileOperations: { refreshTasks: jest.Mock } }).fileOperations;
      fileOperations.refreshTasks.mockImplementation(async ([task]: TaskItem<unknown>[]) => {
        task.line = 3;
      });

      await undoableOps.updateAttributeWithUndo(todo, 'due', '2025-01-15', 'Moved task');

      expect(undoManager.getLastOperation()?.taskChanges[0]).toMatchObject({
        taskId: `${todo.file.id}-3-Test task`,
        lineNumber: 3,
      });
    });

    it('should skip recording when undo disabled', async () => {
      undoManager.updateConfig({ enabled: false });
      const todo = createTodo('1', 'Test task');

      await undoableOps.updateAttributeWithUndo(todo, 'due', '2025-01-15', 'Moved task');

      expect(undoManager.getHistorySize()).toBe(0);
    });

    it('should handle undefined previous value', async () => {
      const todo = createTodo('1', 'Test task', 1, {});

      await undoableOps.updateAttributeWithUndo(todo, 'due', '2025-01-15', 'Set due date');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.taskChanges[0].previousValue).toBeUndefined();
    });
  });

  describe('removeAttributeWithUndo', () => {
    it('should remove attribute and record operation', async () => {
      const todo = createTodo('1', 'Test task', 1, { due: '2025-01-15' });

      await undoableOps.removeAttributeWithUndo(todo, 'due', 'Cleared due date');

      expect(undoManager.getHistorySize()).toBe(1);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.taskChanges[0].previousValue).toBe('2025-01-15');
      expect(lastOp?.taskChanges[0].newValue).toBeUndefined();
    });

    it('should skip recording when undo disabled', async () => {
      undoManager.updateConfig({ enabled: false });
      const todo = createTodo('1', 'Test task', 1, { due: '2025-01-15' });

      await undoableOps.removeAttributeWithUndo(todo, 'due', 'Cleared');

      expect(undoManager.getHistorySize()).toBe(0);
    });
  });

  describe('updateTaskStatusWithUndo', () => {
    it('should update status and record operation', async () => {
      const todo = createTodo('1', 'Test task', 1, {}, [], TaskStatus.Complete);

      await undoableOps.updateTaskStatusWithUndo(todo, TaskStatus.Todo, 'Completed task');

      expect(undoManager.getHistorySize()).toBe(1);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.statusChanges).toHaveLength(1);
      expect(lastOp?.statusChanges[0].previousStatus).toBe(TaskStatus.Todo);
      expect(lastOp?.statusChanges[0].newStatus).toBe(TaskStatus.Complete);
    });

    it('should capture completed date for completed tasks', async () => {
      const todo = createTodo('1', 'Test task', 1, {}, [], TaskStatus.Complete);

      await undoableOps.updateTaskStatusWithUndo(todo, TaskStatus.Todo, 'Completed');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.statusChanges[0].newCompletedDate).toBeDefined();
    });

    it('should skip recording when undo disabled', async () => {
      undoManager.updateConfig({ enabled: false });
      const todo = createTodo('1', 'Test task', 1, {}, [], TaskStatus.Complete);

      await undoableOps.updateTaskStatusWithUndo(todo, TaskStatus.Todo, 'Completed');

      expect(undoManager.getHistorySize()).toBe(0);
    });
  });

  describe('appendTagWithUndo', () => {
    it('should append tag and record operation', async () => {
      const todo = createTodo('1', 'Test task', 1, {}, []);

      await undoableOps.appendTagWithUndo(todo, 'urgent', 'Added urgent tag');

      expect(undoManager.getHistorySize()).toBe(1);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.tagChanges).toHaveLength(1);
      expect(lastOp?.tagChanges[0].tag).toBe('urgent');
      expect(lastOp?.tagChanges[0].action).toBe('added');
    });

    it('should skip if tag already exists', async () => {
      const todo = createTodo('1', 'Test task', 1, {}, ['urgent']);

      await undoableOps.appendTagWithUndo(todo, 'urgent', 'Added tag');

      expect(undoManager.getHistorySize()).toBe(0);
    });

    it('uses refreshed tag state before recording undo', async () => {
      const todo = createTodo('1', 'Test task', 1, {}, []);
      const fileOperations = (undoableOps as unknown as { fileOperations: { refreshTasks: jest.Mock; appendTag: jest.Mock } }).fileOperations;
      fileOperations.refreshTasks.mockImplementation(async ([task]: TaskItem<unknown>[]) => {
        task.tags = ['urgent'];
      });

      await undoableOps.appendTagWithUndo(todo, 'urgent', 'Added tag');

      expect(fileOperations.appendTag).not.toHaveBeenCalled();
      expect(undoManager.getHistorySize()).toBe(0);
    });

    it('does not skip an append based on a stale tag snapshot', async () => {
      const todo = createTodo('1', 'Test task', 1, {}, ['urgent']);
      const fileOperations = (undoableOps as unknown as { fileOperations: { refreshTasks: jest.Mock; appendTag: jest.Mock } }).fileOperations;
      fileOperations.refreshTasks.mockImplementation(async ([task]: TaskItem<unknown>[]) => {
        task.tags = [];
      });

      await undoableOps.appendTagWithUndo(todo, 'urgent', 'Added tag');

      expect(fileOperations.appendTag).toHaveBeenCalledWith(todo, 'urgent');
      expect(undoManager.getHistorySize()).toBe(1);
    });

    it('should skip recording when undo disabled', async () => {
      undoManager.updateConfig({ enabled: false });
      const todo = createTodo('1', 'Test task', 1, {}, []);

      await undoableOps.appendTagWithUndo(todo, 'urgent', 'Added tag');

      expect(undoManager.getHistorySize()).toBe(0);
    });
  });

  describe('batchUpdateAttributeWithUndo', () => {
    it('should update multiple todos and record batch operation', async () => {
      const todos = [
        createTodo('1', 'Task 1', 1, { due: '2025-01-10' }),
        createTodo('2', 'Task 2', 2, { due: '2025-01-11' }),
        createTodo('3', 'Task 3', 3, {}),
      ];

      await undoableOps.batchUpdateAttributeWithUndo(todos, 'due', '2025-01-15', 'Moved 3 tasks');

      expect(undoManager.getHistorySize()).toBe(1);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.type).toBe('batch');
      expect(lastOp?.taskChanges).toHaveLength(3);
    });

    it('should capture all previous values', async () => {
      const todos = [
        createTodo('1', 'Task 1', 1, { due: '2025-01-10' }),
        createTodo('2', 'Task 2', 2, {}),
      ];

      await undoableOps.batchUpdateAttributeWithUndo(todos, 'due', '2025-01-15', 'Batch move');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.taskChanges[0].previousValue).toBe('2025-01-10');
      expect(lastOp?.taskChanges[1].previousValue).toBeUndefined();
    });

    it('should skip when array is empty', async () => {
      await undoableOps.batchUpdateAttributeWithUndo([], 'due', '2025-01-15', 'Empty batch');

      expect(undoManager.getHistorySize()).toBe(0);
    });

    it('should skip recording when undo disabled', async () => {
      undoManager.updateConfig({ enabled: false });
      const todos = [createTodo('1', 'Task 1')];

      await undoableOps.batchUpdateAttributeWithUndo(todos, 'due', '2025-01-15', 'Batch');

      expect(undoManager.getHistorySize()).toBe(0);
    });
  });

  describe('batchRemoveAttributeWithUndo', () => {
    it('should skip recording when undo disabled', async () => {
      undoManager.updateConfig({ enabled: false });
      const todos = [createTodo('1', 'Task 1', 1, { due: '2025-01-15' })];

      await undoableOps.batchRemoveAttributeWithUndo(todos, 'due', 'Cleared');

      expect(undoManager.getHistorySize()).toBe(0);
    });
    it('should remove attribute from multiple todos', async () => {
      const todos = [
        createTodo('1', 'Task 1', 1, { due: '2025-01-10' }),
        createTodo('2', 'Task 2', 2, { due: '2025-01-11' }),
      ];

      await undoableOps.batchRemoveAttributeWithUndo(todos, 'due', 'Cleared dates');

      expect(undoManager.getHistorySize()).toBe(1);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.taskChanges).toHaveLength(2);
      expect(lastOp?.taskChanges[0].newValue).toBeUndefined();
    });

    it('should skip when array is empty', async () => {
      await undoableOps.batchRemoveAttributeWithUndo([], 'due', 'Empty');

      expect(undoManager.getHistorySize()).toBe(0);
    });
  });

  describe('batchUpdateTaskStatusWithUndo', () => {
    it('should update status for multiple todos', async () => {
      const todos = [
        createTodo('1', 'Task 1', 1, {}, [], TaskStatus.Todo),
        createTodo('2', 'Task 2', 2, {}, [], TaskStatus.InProgress),
      ];

      await undoableOps.batchUpdateTaskStatusWithUndo(todos, TaskStatus.Complete, 'Completed tasks');

      expect(undoManager.getHistorySize()).toBe(1);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.statusChanges).toHaveLength(2);
    });

    it('should skip when array is empty', async () => {
      await undoableOps.batchUpdateTaskStatusWithUndo([], TaskStatus.Complete, 'Empty');

      expect(undoManager.getHistorySize()).toBe(0);
    });

    it('should skip recording when undo disabled', async () => {
      undoManager.updateConfig({ enabled: false });
      const todos = [createTodo('1', 'Task 1', 1, {}, [], TaskStatus.Todo)];

      await undoableOps.batchUpdateTaskStatusWithUndo(todos, TaskStatus.Complete, 'Completed');

      expect(undoManager.getHistorySize()).toBe(0);
    });

    it('restores task status when the write fails', async () => {
      const todos = [createTodo('1', 'Task 1', 1, {}, [], TaskStatus.Todo)];
      const fileOperations = (undoableOps as unknown as { fileOperations: { batchUpdateTaskStatus: jest.Mock } }).fileOperations;
      fileOperations.batchUpdateTaskStatus.mockRejectedValueOnce(new Error('write failed'));

      await expect(undoableOps.batchUpdateTaskStatusWithUndo(todos, TaskStatus.Complete, 'Completed')).rejects.toThrow('write failed');

      expect(todos[0].status).toBe(TaskStatus.Todo);
      expect(undoManager.getHistorySize()).toBe(0);
    });
  });

  describe('batchAppendTagWithUndo', () => {
    it('should skip recording when undo disabled', async () => {
      undoManager.updateConfig({ enabled: false });
      const todos = [createTodo('1', 'Task 1')];

      await undoableOps.batchAppendTagWithUndo(todos, 'urgent', 'Tagged');

      expect(undoManager.getHistorySize()).toBe(0);
    });
    it('should append tag to multiple todos', async () => {
      const todos = [
        createTodo('1', 'Task 1', 1, {}, []),
        createTodo('2', 'Task 2', 2, {}, ['other']),
      ];

      await undoableOps.batchAppendTagWithUndo(todos, 'urgent', 'Tagged urgent');

      expect(undoManager.getHistorySize()).toBe(1);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.tagChanges).toHaveLength(2);
    });

    it('should skip todos that already have the tag', async () => {
      const todos = [
        createTodo('1', 'Task 1', 1, {}, ['urgent']),
        createTodo('2', 'Task 2', 2, {}, []),
      ];

      await undoableOps.batchAppendTagWithUndo(todos, 'urgent', 'Tagged');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.tagChanges).toHaveLength(1);
    });

    it('builds batch undo from refreshed tag state', async () => {
      const todos = [createTodo('1', 'Task 1', 1, {}, []), createTodo('2', 'Task 2', 2, {}, [])];
      const fileOperations = (undoableOps as unknown as { fileOperations: { refreshTasks: jest.Mock } }).fileOperations;
      fileOperations.refreshTasks.mockImplementation(async ([first]: TaskItem<unknown>[]) => {
        first.tags = ['urgent'];
      });

      await undoableOps.batchAppendTagWithUndo(todos, 'urgent', 'Tagged');

      expect(undoManager.getLastOperation()?.tagChanges).toHaveLength(1);
      expect(undoManager.getLastOperation()?.tagChanges[0].taskId).toContain('file-2');
    });

    it('should skip when all todos already have tag', async () => {
      const todos = [
        createTodo('1', 'Task 1', 1, {}, ['urgent']),
        createTodo('2', 'Task 2', 2, {}, ['urgent']),
      ];

      await undoableOps.batchAppendTagWithUndo(todos, 'urgent', 'Tagged');

      expect(undoManager.getHistorySize()).toBe(0);
    });
  });

  describe('combinedMoveWithUndo', () => {
    it('should handle combined attribute, tag, and status changes', async () => {
      const todos = [createTodo('1', 'Task 1', 1, { due: '2025-01-10' }, [])];

      await undoableOps.combinedMoveWithUndo(
        todos,
        'due',
        '2025-01-15',
        'project',
        TaskStatus.Complete,
        'Moved and completed'
      );

      expect(undoManager.getHistorySize()).toBe(1);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.taskChanges).toHaveLength(1);
      expect(lastOp?.tagChanges).toHaveLength(1);
      expect(lastOp?.statusChanges).toHaveLength(1);
    });

    it('should work with just attribute change', async () => {
      const todos = [createTodo('1', 'Task 1')];

      await undoableOps.combinedMoveWithUndo(todos, 'due', '2025-01-15');

      expect(undoManager.getHistorySize()).toBe(1);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.taskChanges).toHaveLength(1);
      expect(lastOp?.tagChanges).toHaveLength(0);
      expect(lastOp?.statusChanges).toHaveLength(0);
    });

    it('should generate description when not provided', async () => {
      const todos = [createTodo('1', 'Task 1')];

      await undoableOps.combinedMoveWithUndo(todos, 'due', '2025-01-15');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.description).toBe('Moved task to 2025-01-15');
    });

    it('should format batch description correctly', async () => {
      const todos = [
        createTodo('1', 'Task 1'),
        createTodo('2', 'Task 2'),
        createTodo('3', 'Task 3'),
      ];

      await undoableOps.combinedMoveWithUndo(todos, 'due', 'Tomorrow');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.description).toBe('Moved 3 tasks to Tomorrow');
      expect(lastOp?.type).toBe('batch');
    });

    it('should skip when array is empty', async () => {
      await undoableOps.combinedMoveWithUndo([], 'due', '2025-01-15');

      expect(undoManager.getHistorySize()).toBe(0);
    });

    it('should skip tags already on todo', async () => {
      const todos = [createTodo('1', 'Task 1', 1, {}, ['project'])];

      await undoableOps.combinedMoveWithUndo(todos, 'due', '2025-01-15', 'project');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.tagChanges).toHaveLength(0);
    });

    it('should skip recording when undo disabled', async () => {
      undoManager.updateConfig({ enabled: false });
      const todos = [createTodo('1', 'Task 1', 1, {}, ['oldtag'])];

      await undoableOps.combinedMoveWithUndo(
        todos,
        'due',
        '2025-01-15',
        'newtag',
        TaskStatus.Complete,
        'Move task',
        ['oldtag'] // Include tagsToRemove to cover lines 354-355
      );

      expect(undoManager.getHistorySize()).toBe(0);
    });

    it('should remove specified tags', async () => {
      const todos = [createTodo('1', 'Task with tag', 1, { due: '2025-01-10' }, ['event', 'work'])];

      await undoableOps.combinedMoveWithUndo(
        todos,
        'due',
        '2025-01-15',
        undefined,
        undefined,
        'Move task',
        ['event'] // Tags to remove
      );

      expect(undoManager.getHistorySize()).toBe(1);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.tagChanges).toHaveLength(1);
      expect(lastOp?.tagChanges[0].tag).toBe('event');
      expect(lastOp?.tagChanges[0].action).toBe('removed');
    });

    it('should skip removing tags not on todo', async () => {
      const todos = [createTodo('1', 'Task without tag', 1, {}, ['other'])];

      await undoableOps.combinedMoveWithUndo(
        todos,
        'due',
        '2025-01-15',
        undefined,
        undefined,
        'Move task',
        ['event'] // This tag is not on the todo
      );

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.tagChanges).toHaveLength(0);
    });

    it('should handle both adding and removing tags', async () => {
      const todos = [createTodo('1', 'Task', 1, {}, ['oldtag'])];

      await undoableOps.combinedMoveWithUndo(
        todos,
        'due',
        '2025-01-15',
        'newtag', // Add this tag
        undefined,
        'Move task',
        ['oldtag'] // Remove this tag
      );

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.tagChanges).toHaveLength(2);

      const addedTag = lastOp?.tagChanges.find(c => c.action === 'added');
      const removedTag = lastOp?.tagChanges.find(c => c.action === 'removed');

      expect(addedTag?.tag).toBe('newtag');
      expect(removedTag?.tag).toBe('oldtag');
    });
  });

  describe('applyUndo', () => {
    it('should restore previous attribute value', async () => {
      const todo = createTodo('1', 'Task 1', 1, { due: '2025-01-15' });
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          attributeName: 'due',
          previousValue: '2025-01-10',
          newValue: '2025-01-15',
        }],
        statusChanges: [],
        tagChanges: [],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(true);
      expect(findTodo).toHaveBeenCalledWith('notes/1.md:1', 'notes/1.md', undefined);
    });

    it('should remove attribute when previous value was undefined', async () => {
      const todo = createTodo('1', 'Task 1');
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          attributeName: 'due',
          previousValue: undefined,
          newValue: '2025-01-15',
        }],
        statusChanges: [],
        tagChanges: [],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(true);
    });

    it('should undo tag additions by removing tags', async () => {
      const todo = createTodo('1', 'Task 1', 1, {}, ['urgent']);
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [],
        tagChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          tag: 'urgent',
          action: 'added',
        }],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(true);
    });

    it('should undo tag removals by adding tags back', async () => {
      const todo = createTodo('1', 'Task 1');
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [],
        tagChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          tag: 'urgent',
          action: 'removed',
        }],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(true);
    });

    it('should undo status changes', async () => {
      const todo = createTodo('1', 'Task 1', 1, {}, [], TaskStatus.Complete);
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          previousStatus: TaskStatus.Todo,
          newStatus: TaskStatus.Complete,
        }],
        tagChanges: [],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(true);
      expect(todo.status).toBe(TaskStatus.Todo);
    });

    it('should return false when todo not found', async () => {
      const findTodo = jest.fn().mockReturnValue(undefined);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [{
          taskId: 'missing',
          filePath: 'notes/missing.md',
          lineNumber: 1,
          attributeName: 'due',
          previousValue: '2025-01-10',
          newValue: '2025-01-15',
        }],
        statusChanges: [],
        tagChanges: [],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(false);
    });

    it('should handle multiple changes in batch operation', async () => {
      const todo1 = createTodo('1', 'Task 1');
      const todo2 = createTodo('2', 'Task 2');
      const findTodo = jest.fn()
        .mockReturnValueOnce(todo1)
        .mockReturnValueOnce(todo2);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'batch',
        description: 'Batch undo',
        taskChanges: [
          { taskId: 'id-1', filePath: 'a.md', lineNumber: 1, attributeName: 'due', previousValue: '2025-01-10', newValue: '2025-01-15' },
          { taskId: 'id-2', filePath: 'b.md', lineNumber: 2, attributeName: 'due', previousValue: '2025-01-11', newValue: '2025-01-15' },
        ],
        statusChanges: [],
        tagChanges: [],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(true);
      expect(findTodo).toHaveBeenCalledTimes(2);
    });

    it('should return false without replacing current identity when a task change throws', async () => {
      const { FileOperations } = jest.requireMock('../../src/core/operations/file-operations');
      const mockFileOps = FileOperations.mock.results[FileOperations.mock.results.length - 1].value;
      mockFileOps.updateAttribute.mockRejectedValueOnce(new Error('File write error'));

      const todo = { ...createTodo('1', 'Task 1'), sourceLine: '- [ ] Task 1 [due:: current]', sourceLineCount: 1 };
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          sourceLine: '- [ ] Task 1 [due:: historical]',
          attributeName: 'due',
          previousValue: '2025-01-10',
          newValue: '2025-01-15',
        }],
        statusChanges: [],
        tagChanges: [],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(false);
      expect(todo).toMatchObject({ sourceLine: '- [ ] Task 1 [due:: current]', sourceLineCount: 1 });
    });

    it('should return false when tag change throws error', async () => {
      const { FileOperations } = jest.requireMock('../../src/core/operations/file-operations');
      const mockFileOps = FileOperations.mock.results[FileOperations.mock.results.length - 1].value;
      mockFileOps.removeTag.mockRejectedValueOnce(new Error('Tag error'));

      const todo = createTodo('1', 'Task 1', 1, {}, ['urgent']);
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [],
        tagChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          tag: 'urgent',
          action: 'added',
        }],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(false);
    });

    it('should return false when todo not found for tag change', async () => {
      const findTodo = jest.fn().mockReturnValue(undefined);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [],
        tagChanges: [{
          taskId: 'missing',
          filePath: 'notes/missing.md',
          lineNumber: 1,
          tag: 'urgent',
          action: 'added',
        }],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(false);
    });

    it('should return false when status change throws error', async () => {
      const { FileOperations } = jest.requireMock('../../src/core/operations/file-operations');
      const mockFileOps = FileOperations.mock.results[FileOperations.mock.results.length - 1].value;
      mockFileOps.updateTaskStatus.mockRejectedValueOnce(new Error('Status error'));

      const todo = createTodo('1', 'Task 1', 1, {}, [], TaskStatus.Complete);
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          previousStatus: TaskStatus.Todo,
          newStatus: TaskStatus.Complete,
        }],
        tagChanges: [],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(false);
      expect(todo.status).toBe(TaskStatus.Complete);
    });

    it('should return false when todo not found for status change', async () => {
      const findTodo = jest.fn().mockReturnValue(undefined);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [{
          taskId: 'missing',
          filePath: 'notes/missing.md',
          lineNumber: 1,
          previousStatus: TaskStatus.Todo,
          newStatus: TaskStatus.Complete,
        }],
        tagChanges: [],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(false);
    });

    it('serializes concurrent undo applications', async () => {
      const { FileOperations } = jest.requireMock('../../src/core/operations/file-operations');
      const mockFileOps = FileOperations.mock.results[FileOperations.mock.results.length - 1].value;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      let calls = 0;
      let active = 0;
      let maxActive = 0;
      mockFileOps.updateAttribute.mockImplementation(async () => {
        calls++;
        active++;
        maxActive = Math.max(maxActive, active);
        if (calls === 1) await gate;
        active--;
      });
      const tasks = [createTodo('1', 'Task 1'), createTodo('2', 'Task 2')];
      const operation = (id: string): UndoOperation => ({
        id,
        timestamp: Date.now(),
        type: 'single',
        description: id,
        taskChanges: [{ taskId: id, filePath: `notes/${id}.md`, lineNumber: 1, attributeName: 'due', previousValue: '2026-07-22', newValue: '2026-07-23' }],
        statusChanges: [],
        tagChanges: [],
      });

      const first = undoableOps.applyUndo(operation('1'), (id) => tasks[Number(id) - 1]);
      const second = undoableOps.applyUndo(operation('2'), (id) => tasks[Number(id) - 1]);
      await Promise.resolve();
      await Promise.resolve();
      expect(mockFileOps.updateAttribute).toHaveBeenCalledTimes(1);
      release();

      expect(await Promise.all([first, second])).toEqual([true, true]);
      expect(maxActive).toBe(1);
    });
  });

  describe('applyRedo', () => {
    it('should reapply attribute change', async () => {
      const todo = createTodo('1', 'Task 1', 1, { due: '2025-01-10' });
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          attributeName: 'due',
          previousValue: '2025-01-10',
          newValue: '2025-01-15',
        }],
        statusChanges: [],
        tagChanges: [],
      };

      const success = await undoableOps.applyRedo(operation, findTodo);

      expect(success).toBe(true);
    });

    it('should remove attribute when new value was undefined', async () => {
      const todo = createTodo('1', 'Task 1', 1, { due: '2025-01-10' });
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          attributeName: 'due',
          previousValue: '2025-01-10',
          newValue: undefined,
        }],
        statusChanges: [],
        tagChanges: [],
      };

      const success = await undoableOps.applyRedo(operation, findTodo);

      expect(success).toBe(true);
    });

    it('should redo tag additions', async () => {
      const todo = createTodo('1', 'Task 1');
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [],
        tagChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          tag: 'urgent',
          action: 'added',
        }],
      };

      const success = await undoableOps.applyRedo(operation, findTodo);

      expect(success).toBe(true);
    });

    it('should redo tag removals', async () => {
      const todo = createTodo('1', 'Task 1', 1, {}, ['urgent']);
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [],
        tagChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          tag: 'urgent',
          action: 'removed',
        }],
      };

      const success = await undoableOps.applyRedo(operation, findTodo);

      expect(success).toBe(true);
    });

    it('should redo status changes', async () => {
      const todo = createTodo('1', 'Task 1', 1, {}, [], TaskStatus.Todo);
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          previousStatus: TaskStatus.Todo,
          newStatus: TaskStatus.Complete,
        }],
        tagChanges: [],
      };

      const success = await undoableOps.applyRedo(operation, findTodo);

      expect(success).toBe(true);
      expect(todo.status).toBe(TaskStatus.Complete);
    });

    it('should return false when todo not found', async () => {
      const findTodo = jest.fn().mockReturnValue(undefined);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [{
          taskId: 'missing',
          filePath: 'notes/missing.md',
          lineNumber: 1,
          attributeName: 'due',
          previousValue: '2025-01-10',
          newValue: '2025-01-15',
        }],
        statusChanges: [],
        tagChanges: [],
      };

      const success = await undoableOps.applyRedo(operation, findTodo);

      expect(success).toBe(false);
    });

    it('should return false when task change throws error', async () => {
      const { FileOperations } = jest.requireMock('../../src/core/operations/file-operations');
      const mockFileOps = FileOperations.mock.results[FileOperations.mock.results.length - 1].value;
      mockFileOps.updateAttribute.mockRejectedValueOnce(new Error('File write error'));

      const todo = createTodo('1', 'Task 1');
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          attributeName: 'due',
          previousValue: '2025-01-10',
          newValue: '2025-01-15',
        }],
        statusChanges: [],
        tagChanges: [],
      };

      const success = await undoableOps.applyRedo(operation, findTodo);

      expect(success).toBe(false);
    });

    it('should return false when tag change throws error', async () => {
      const { FileOperations } = jest.requireMock('../../src/core/operations/file-operations');
      const mockFileOps = FileOperations.mock.results[FileOperations.mock.results.length - 1].value;
      mockFileOps.appendTag.mockRejectedValueOnce(new Error('Tag error'));

      const todo = createTodo('1', 'Task 1');
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [],
        tagChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          tag: 'urgent',
          action: 'added',
        }],
      };

      const success = await undoableOps.applyRedo(operation, findTodo);

      expect(success).toBe(false);
    });

    it('should return false when todo not found for tag change', async () => {
      const findTodo = jest.fn().mockReturnValue(undefined);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [],
        tagChanges: [{
          taskId: 'missing',
          filePath: 'notes/missing.md',
          lineNumber: 1,
          tag: 'urgent',
          action: 'added',
        }],
      };

      const success = await undoableOps.applyRedo(operation, findTodo);

      expect(success).toBe(false);
    });

    it('should return false when status change throws error', async () => {
      const { FileOperations } = jest.requireMock('../../src/core/operations/file-operations');
      const mockFileOps = FileOperations.mock.results[FileOperations.mock.results.length - 1].value;
      mockFileOps.updateTaskStatus.mockRejectedValueOnce(new Error('Status error'));

      const todo = createTodo('1', 'Task 1', 1, {}, [], TaskStatus.Todo);
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [{
          taskId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          previousStatus: TaskStatus.Todo,
          newStatus: TaskStatus.Complete,
        }],
        tagChanges: [],
      };

      const success = await undoableOps.applyRedo(operation, findTodo);

      expect(success).toBe(false);
      expect(todo.status).toBe(TaskStatus.Todo);
    });

    it('should return false when todo not found for status change', async () => {
      const findTodo = jest.fn().mockReturnValue(undefined);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [{
          taskId: 'missing',
          filePath: 'notes/missing.md',
          lineNumber: 1,
          previousStatus: TaskStatus.Todo,
          newStatus: TaskStatus.Complete,
        }],
        tagChanges: [],
      };

      const success = await undoableOps.applyRedo(operation, findTodo);

      expect(success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle todo without line number', async () => {
      const todo: TaskItem<unknown> = {
        status: TaskStatus.Todo,
        text: 'Task',
        file: createMockFileAdapter('file-1', 'notes/1.md'),
        line: undefined,
      };

      await undoableOps.updateAttributeWithUndo(todo, 'due', '2025-01-15', 'Test');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.taskChanges[0].lineNumber).toBe(0);
    });

    it('should handle boolean attribute values', async () => {
      const todo = createTodo('1', 'Task 1', 1, { selected: true });

      await undoableOps.updateAttributeWithUndo(todo, 'selected', false, 'Unpinned');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.taskChanges[0].previousValue).toBe(true);
      expect(lastOp?.taskChanges[0].newValue).toBe(false);
    });

    it('should handle null tags array', async () => {
      const todo: TaskItem<unknown> = {
        status: TaskStatus.Todo,
        text: 'Task',
        file: createMockFileAdapter('file-1', 'notes/1.md'),
        line: 1,
        tags: undefined,
      };

      await undoableOps.appendTagWithUndo(todo, 'urgent', 'Tagged');

      expect(undoManager.getHistorySize()).toBe(1);
    });
  });

  describe('branch coverage - line number fallback', () => {
    it('should use line number 0 for removeAttributeWithUndo when line is undefined', async () => {
      const todo: TaskItem<unknown> = {
        status: TaskStatus.Todo,
        text: 'Task',
        file: createMockFileAdapter('file-1', 'notes/1.md'),
        line: undefined,
        attributes: { due: '2025-01-15' },
      };

      await undoableOps.removeAttributeWithUndo(todo, 'due', 'Cleared');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.taskChanges[0].lineNumber).toBe(0);
    });

    it('should use line number 0 for appendTagWithUndo when line is undefined', async () => {
      const todo: TaskItem<unknown> = {
        status: TaskStatus.Todo,
        text: 'Task',
        file: createMockFileAdapter('file-1', 'notes/1.md'),
        line: undefined,
        tags: [],
      };

      await undoableOps.appendTagWithUndo(todo, 'urgent', 'Tagged');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.tagChanges[0].lineNumber).toBe(0);
    });

    it('should use line number 0 for batchUpdateAttributeWithUndo when line is undefined', async () => {
      const todos: TaskItem<unknown>[] = [{
        status: TaskStatus.Todo,
        text: 'Task',
        file: createMockFileAdapter('file-1', 'notes/1.md'),
        line: undefined,
      }];

      await undoableOps.batchUpdateAttributeWithUndo(todos, 'due', '2025-01-15', 'Moved');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.taskChanges[0].lineNumber).toBe(0);
    });

    it('should use line number 0 for batchRemoveAttributeWithUndo when line is undefined', async () => {
      const todos: TaskItem<unknown>[] = [{
        status: TaskStatus.Todo,
        text: 'Task',
        file: createMockFileAdapter('file-1', 'notes/1.md'),
        line: undefined,
        attributes: { due: '2025-01-15' },
      }];

      await undoableOps.batchRemoveAttributeWithUndo(todos, 'due', 'Cleared');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.taskChanges[0].lineNumber).toBe(0);
    });

    it('should use line number 0 for batchAppendTagWithUndo when line is undefined', async () => {
      const todos: TaskItem<unknown>[] = [{
        status: TaskStatus.Todo,
        text: 'Task',
        file: createMockFileAdapter('file-1', 'notes/1.md'),
        line: undefined,
        tags: [],
      }];

      await undoableOps.batchAppendTagWithUndo(todos, 'urgent', 'Tagged');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.tagChanges[0].lineNumber).toBe(0);
    });

    it('should use line number 0 for batchUpdateTaskStatusWithUndo when line is undefined', async () => {
      const todos: TaskItem<unknown>[] = [{
        status: TaskStatus.Todo,
        text: 'Task',
        file: createMockFileAdapter('file-1', 'notes/1.md'),
        line: undefined,
      }];

      await undoableOps.batchUpdateTaskStatusWithUndo(todos, TaskStatus.Complete, 'Completed');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.statusChanges[0].lineNumber).toBe(0);
    });

    it('should use line number 0 for combinedMoveWithUndo when line is undefined', async () => {
      const todos: TaskItem<unknown>[] = [{
        status: TaskStatus.Todo,
        text: 'Task',
        file: createMockFileAdapter('file-1', 'notes/1.md'),
        line: undefined,
        tags: [],
      }];

      await undoableOps.combinedMoveWithUndo(todos, 'due', '2025-01-15', 'project', TaskStatus.InProgress, 'Move');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.taskChanges[0].lineNumber).toBe(0);
      expect(lastOp?.tagChanges[0].lineNumber).toBe(0);
      expect(lastOp?.statusChanges[0].lineNumber).toBe(0);
    });
  });

  describe('branch coverage - status transitions', () => {
    it('should track completed date when transitioning to Canceled status', async () => {
      const todo = createTodo('1', 'Task 1', 1, {}, [], TaskStatus.Canceled);

      await undoableOps.updateTaskStatusWithUndo(todo, TaskStatus.Todo, 'Canceled task');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.statusChanges[0].newCompletedDate).toBeDefined();
    });

    it('should track previous completed date when was previously Canceled', async () => {
      const todo = createTodo('1', 'Task 1', 1, { completed: '2025-01-10' }, [], TaskStatus.Todo);

      await undoableOps.updateTaskStatusWithUndo(todo, TaskStatus.Canceled, 'Uncanceled task');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.statusChanges[0].previousCompletedDate).toBe('2025-01-10');
    });

    it('should handle batch status update with Canceled status', async () => {
      const todos = [createTodo('1', 'Task 1', 1, {}, [], TaskStatus.Todo)];

      await undoableOps.batchUpdateTaskStatusWithUndo(todos, TaskStatus.Canceled, 'Batch canceled');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.statusChanges[0].newCompletedDate).toBeDefined();
    });

    it('should handle batch status when previous was Canceled', async () => {
      const todos = [createTodo('1', 'Task 1', 1, { completed: '2025-01-10' }, [], TaskStatus.Canceled)];

      await undoableOps.batchUpdateTaskStatusWithUndo(todos, TaskStatus.Todo, 'Uncanceled');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.statusChanges[0].previousCompletedDate).toBe('2025-01-10');
    });

    it('should handle combined move with Canceled status', async () => {
      const todos = [createTodo('1', 'Task 1', 1, {}, [])];

      await undoableOps.combinedMoveWithUndo(
        todos,
        'due',
        '2025-01-15',
        undefined,
        TaskStatus.Canceled,
        'Canceled'
      );

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.statusChanges[0].newCompletedDate).toBeDefined();
    });

    it('should handle combined move when previous status was Canceled', async () => {
      const todos = [createTodo('1', 'Task 1', 1, { completed: '2025-01-10' }, [], TaskStatus.Canceled)];

      await undoableOps.combinedMoveWithUndo(
        todos,
        'due',
        '2025-01-15',
        undefined,
        TaskStatus.Todo,
        'Uncanceled'
      );

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.statusChanges[0].previousCompletedDate).toBe('2025-01-10');
    });
  });

  describe('branch coverage - refreshed status', () => {
    it('records the refreshed task status', async () => {
      const todos = [createTodo('1', 'Task 1', 1, {}, [], TaskStatus.Todo)];
      const fileOperations = (undoableOps as unknown as { fileOperations: { refreshTasks: jest.Mock } }).fileOperations;
      fileOperations.refreshTasks.mockImplementation(async ([task]: TaskItem<unknown>[]) => {
        task.status = TaskStatus.InProgress;
      });

      await undoableOps.batchUpdateTaskStatusWithUndo(todos, TaskStatus.Complete, 'Completed');

      expect(undoManager.getLastOperation()?.statusChanges[0].previousStatus).toBe(TaskStatus.InProgress);
    });
  });

  describe('branch coverage - combinedMoveWithUndo with undo disabled', () => {
    it('should handle tag addition when undo disabled', async () => {
      undoManager.updateConfig({ enabled: false });
      const todos = [createTodo('1', 'Task 1', 1, {}, [])];

      await undoableOps.combinedMoveWithUndo(
        todos,
        'due',
        '2025-01-15',
        'newtag'
      );

      expect(undoManager.getHistorySize()).toBe(0);
    });

    it('should handle status change when undo disabled', async () => {
      undoManager.updateConfig({ enabled: false });
      const todos = [createTodo('1', 'Task 1', 1, {}, [])];

      await undoableOps.combinedMoveWithUndo(
        todos,
        'due',
        '2025-01-15',
        undefined,
        TaskStatus.Complete
      );

      expect(undoManager.getHistorySize()).toBe(0);
    });
  });
});
