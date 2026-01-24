import { UndoableFileOperations } from '../../src/core/operations/undoable-file-ops';
import { UndoManager, UndoOperation } from '../../src/core/operations/undo-manager';
import { TodoItem, TodoStatus } from '../../src/types/todo';
import { FileAdapter } from '../../src/types/file-adapter';
import { TaskPlannerSettings, DEFAULT_SETTINGS } from '../../src/settings/types';

// Mock FileOperations
jest.mock('../../src/core/operations/file-operations', () => {
  return {
    FileOperations: jest.fn().mockImplementation(() => ({
      updateAttribute: jest.fn().mockResolvedValue(undefined),
      removeAttribute: jest.fn().mockResolvedValue(undefined),
      updateTodoStatus: jest.fn().mockResolvedValue(undefined),
      appendTag: jest.fn().mockResolvedValue(undefined),
      removeTag: jest.fn().mockResolvedValue(undefined),
      batchUpdateAttribute: jest.fn().mockResolvedValue(undefined),
      batchRemoveAttribute: jest.fn().mockResolvedValue(undefined),
      batchUpdateTodoStatus: jest.fn().mockResolvedValue(undefined),
      batchAppendTag: jest.fn().mockResolvedValue(undefined),
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
  status: TodoStatus = TodoStatus.Todo
): TodoItem<unknown> => ({
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

  describe('updateTodoStatusWithUndo', () => {
    it('should update status and record operation', async () => {
      const todo = createTodo('1', 'Test task', 1, {}, [], TodoStatus.Complete);

      await undoableOps.updateTodoStatusWithUndo(todo, TodoStatus.Todo, 'Completed task');

      expect(undoManager.getHistorySize()).toBe(1);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.statusChanges).toHaveLength(1);
      expect(lastOp?.statusChanges[0].previousStatus).toBe(TodoStatus.Todo);
      expect(lastOp?.statusChanges[0].newStatus).toBe(TodoStatus.Complete);
    });

    it('should capture completed date for completed tasks', async () => {
      const todo = createTodo('1', 'Test task', 1, {}, [], TodoStatus.Complete);

      await undoableOps.updateTodoStatusWithUndo(todo, TodoStatus.Todo, 'Completed');

      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.statusChanges[0].newCompletedDate).toBeDefined();
    });

    it('should skip recording when undo disabled', async () => {
      undoManager.updateConfig({ enabled: false });
      const todo = createTodo('1', 'Test task', 1, {}, [], TodoStatus.Complete);

      await undoableOps.updateTodoStatusWithUndo(todo, TodoStatus.Todo, 'Completed');

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

  describe('batchUpdateTodoStatusWithUndo', () => {
    it('should update status for multiple todos', async () => {
      const todos = [
        createTodo('1', 'Task 1', 1, {}, [], TodoStatus.Complete),
        createTodo('2', 'Task 2', 2, {}, [], TodoStatus.Complete),
      ];
      const previousStatuses = new Map([
        ['notes/1.md:1', TodoStatus.Todo],
        ['notes/2.md:2', TodoStatus.InProgress],
      ]);

      await undoableOps.batchUpdateTodoStatusWithUndo(todos, previousStatuses, 'Completed tasks');

      expect(undoManager.getHistorySize()).toBe(1);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.statusChanges).toHaveLength(2);
    });

    it('should skip when array is empty', async () => {
      await undoableOps.batchUpdateTodoStatusWithUndo([], new Map(), 'Empty');

      expect(undoManager.getHistorySize()).toBe(0);
    });
  });

  describe('batchAppendTagWithUndo', () => {
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
        TodoStatus.Complete,
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
      const todos = [createTodo('1', 'Task 1')];

      await undoableOps.combinedMoveWithUndo(todos, 'due', '2025-01-15', 'tag', TodoStatus.Complete);

      expect(undoManager.getHistorySize()).toBe(0);
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
          todoId: 'notes/1.md:1',
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
      expect(findTodo).toHaveBeenCalledWith('notes/1.md:1');
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
          todoId: 'notes/1.md:1',
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
          todoId: 'notes/1.md:1',
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
          todoId: 'notes/1.md:1',
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
      const todo = createTodo('1', 'Task 1', 1, {}, [], TodoStatus.Complete);
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [{
          todoId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          previousStatus: TodoStatus.Todo,
          newStatus: TodoStatus.Complete,
        }],
        tagChanges: [],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(true);
      expect(todo.status).toBe(TodoStatus.Todo);
    });

    it('should return false when todo not found', async () => {
      const findTodo = jest.fn().mockReturnValue(undefined);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [{
          todoId: 'missing',
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
          { todoId: 'id-1', filePath: 'a.md', lineNumber: 1, attributeName: 'due', previousValue: '2025-01-10', newValue: '2025-01-15' },
          { todoId: 'id-2', filePath: 'b.md', lineNumber: 2, attributeName: 'due', previousValue: '2025-01-11', newValue: '2025-01-15' },
        ],
        statusChanges: [],
        tagChanges: [],
      };

      const success = await undoableOps.applyUndo(operation, findTodo);

      expect(success).toBe(true);
      expect(findTodo).toHaveBeenCalledTimes(2);
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
          todoId: 'notes/1.md:1',
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
          todoId: 'notes/1.md:1',
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
          todoId: 'notes/1.md:1',
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
          todoId: 'notes/1.md:1',
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
      const todo = createTodo('1', 'Task 1', 1, {}, [], TodoStatus.Todo);
      const findTodo = jest.fn().mockReturnValue(todo);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [],
        statusChanges: [{
          todoId: 'notes/1.md:1',
          filePath: 'notes/1.md',
          lineNumber: 1,
          previousStatus: TodoStatus.Todo,
          newStatus: TodoStatus.Complete,
        }],
        tagChanges: [],
      };

      const success = await undoableOps.applyRedo(operation, findTodo);

      expect(success).toBe(true);
      expect(todo.status).toBe(TodoStatus.Complete);
    });

    it('should return false when todo not found', async () => {
      const findTodo = jest.fn().mockReturnValue(undefined);

      const operation: UndoOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'single',
        description: 'Test',
        taskChanges: [{
          todoId: 'missing',
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
  });

  describe('edge cases', () => {
    it('should handle todo without line number', async () => {
      const todo: TodoItem<unknown> = {
        status: TodoStatus.Todo,
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
      const todo: TodoItem<unknown> = {
        status: TodoStatus.Todo,
        text: 'Task',
        file: createMockFileAdapter('file-1', 'notes/1.md'),
        line: 1,
        tags: undefined,
      };

      await undoableOps.appendTagWithUndo(todo, 'urgent', 'Tagged');

      expect(undoManager.getHistorySize()).toBe(1);
    });
  });
});
