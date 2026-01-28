import { UndoManager, UndoOperation, TaskChange, StatusChange, TagChange } from '../../src/core/operations/undo-manager';
import { TaskStatus } from '../../src/types/task';

describe('UndoManager', () => {
  let undoManager: UndoManager;

  beforeEach(() => {
    undoManager = new UndoManager({
      maxHistorySize: 10,
      maxHistoryAgeMs: 300000,
      enabled: true,
    });
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const manager = new UndoManager();
      expect(manager.isEnabled()).toBe(true);
    });

    it('should create with custom config', () => {
      const manager = new UndoManager({
        enabled: false,
        maxHistorySize: 5,
      });
      expect(manager.isEnabled()).toBe(false);
    });
  });

  describe('recordOperation', () => {
    it('should record an operation', () => {
      const operation = createMockOperation('test-1');
      undoManager.recordOperation(operation);
      expect(undoManager.getHistorySize()).toBe(1);
    });

    it('should not record when disabled', () => {
      undoManager.updateConfig({ enabled: false });
      const operation = createMockOperation('test-1');
      undoManager.recordOperation(operation);
      expect(undoManager.getHistorySize()).toBe(0);
    });

    it('should clear redo stack on new operation', () => {
      // Record an operation
      undoManager.recordOperation(createMockOperation('op-1'));
      // Undo it
      undoManager.popForUndo();
      expect(undoManager.canRedo()).toBe(true);

      // Record a new operation
      undoManager.recordOperation(createMockOperation('op-2'));
      // Redo stack should be cleared
      expect(undoManager.canRedo()).toBe(false);
    });

    it('should fire onOperationRecorded event', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      undoManager.onOperationRecorded.listen(handler);

      const operation = createMockOperation('test-1');
      undoManager.recordOperation(operation);

      // Wait for async event
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(handler).toHaveBeenCalledWith(operation);
    });

    it('should enforce maxHistorySize', () => {
      const manager = new UndoManager({ maxHistorySize: 3, enabled: true });

      manager.recordOperation(createMockOperation('op-1'));
      manager.recordOperation(createMockOperation('op-2'));
      manager.recordOperation(createMockOperation('op-3'));
      manager.recordOperation(createMockOperation('op-4'));

      expect(manager.getHistorySize()).toBe(3);
      expect(manager.getLastOperation()?.id).toBe('op-4');
    });
  });

  describe('canUndo', () => {
    it('should return false when history is empty', () => {
      expect(undoManager.canUndo()).toBe(false);
    });

    it('should return true when history has operations', () => {
      undoManager.recordOperation(createMockOperation('test-1'));
      expect(undoManager.canUndo()).toBe(true);
    });

    it('should return false when disabled', () => {
      undoManager.recordOperation(createMockOperation('test-1'));
      undoManager.updateConfig({ enabled: false });
      expect(undoManager.canUndo()).toBe(false);
    });
  });

  describe('canRedo', () => {
    it('should return false when redo stack is empty', () => {
      expect(undoManager.canRedo()).toBe(false);
    });

    it('should return true after an undo', () => {
      undoManager.recordOperation(createMockOperation('test-1'));
      undoManager.popForUndo();
      expect(undoManager.canRedo()).toBe(true);
    });

    it('should return false when disabled', () => {
      undoManager.recordOperation(createMockOperation('test-1'));
      undoManager.popForUndo();
      undoManager.updateConfig({ enabled: false });
      expect(undoManager.canRedo()).toBe(false);
    });
  });

  describe('popForUndo', () => {
    it('should return null when history is empty', () => {
      expect(undoManager.popForUndo()).toBeNull();
    });

    it('should return the last operation and move to redo stack', () => {
      const operation = createMockOperation('test-1');
      undoManager.recordOperation(operation);

      const undone = undoManager.popForUndo();
      expect(undone).toEqual(operation);
      expect(undoManager.getHistorySize()).toBe(0);
      expect(undoManager.getRedoStackSize()).toBe(1);
    });

    it('should fire onUndoPerformed event', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      undoManager.onUndoPerformed.listen(handler);

      const operation = createMockOperation('test-1');
      undoManager.recordOperation(operation);
      undoManager.popForUndo();

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(handler).toHaveBeenCalledWith(operation);
    });
  });

  describe('popForRedo', () => {
    it('should return null when redo stack is empty', () => {
      expect(undoManager.popForRedo()).toBeNull();
    });

    it('should return the last undone operation and move back to history', () => {
      const operation = createMockOperation('test-1');
      undoManager.recordOperation(operation);
      undoManager.popForUndo();

      const redone = undoManager.popForRedo();
      expect(redone).toEqual(operation);
      expect(undoManager.getHistorySize()).toBe(1);
      expect(undoManager.getRedoStackSize()).toBe(0);
    });

    it('should fire onRedoPerformed event', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      undoManager.onRedoPerformed.listen(handler);

      const operation = createMockOperation('test-1');
      undoManager.recordOperation(operation);
      undoManager.popForUndo();
      undoManager.popForRedo();

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(handler).toHaveBeenCalledWith(operation);
    });
  });

  describe('getLastOperation', () => {
    it('should return null when history is empty', () => {
      expect(undoManager.getLastOperation()).toBeNull();
    });

    it('should return the most recent operation', () => {
      undoManager.recordOperation(createMockOperation('op-1'));
      undoManager.recordOperation(createMockOperation('op-2'));

      expect(undoManager.getLastOperation()?.id).toBe('op-2');
    });
  });

  describe('clearHistory', () => {
    it('should clear all history and redo stack', () => {
      undoManager.recordOperation(createMockOperation('op-1'));
      undoManager.recordOperation(createMockOperation('op-2'));
      undoManager.popForUndo();

      undoManager.clearHistory();

      expect(undoManager.getHistorySize()).toBe(0);
      expect(undoManager.getRedoStackSize()).toBe(0);
    });
  });

  describe('pruneOldOperations', () => {
    it('should remove operations older than maxAge', () => {
      const manager = new UndoManager({
        maxHistorySize: 10,
        maxHistoryAgeMs: 100, // 100ms for testing
        enabled: true,
      });

      const oldOperation = createMockOperation('old', Date.now() - 200);
      const newOperation = createMockOperation('new', Date.now());

      // Manually add old operation (bypassing recordOperation which would set timestamp)
      manager.recordOperation(oldOperation);
      manager.recordOperation(newOperation);

      manager.pruneOldOperations();

      expect(manager.getHistorySize()).toBe(1);
      expect(manager.getLastOperation()?.id).toBe('new');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      expect(undoManager.isEnabled()).toBe(true);
      undoManager.updateConfig({ enabled: false });
      expect(undoManager.isEnabled()).toBe(false);
    });
  });

  describe('static helpers', () => {
    it('generateOperationId should create unique IDs', () => {
      const id1 = UndoManager.generateOperationId();
      const id2 = UndoManager.generateOperationId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^undo-\d+-\w+$/);
    });

    it('createMoveDescription should format single task', () => {
      expect(UndoManager.createMoveDescription(1, 'Tomorrow')).toBe('Moved task to Tomorrow');
    });

    it('createMoveDescription should format multiple tasks', () => {
      expect(UndoManager.createMoveDescription(3, 'Next Week')).toBe('Moved 3 tasks to Next Week');
    });

    it('createStatusDescription should format single task', () => {
      expect(UndoManager.createStatusDescription(1, TaskStatus.Complete)).toBe('Changed task to Complete');
    });

    it('createStatusDescription should format multiple tasks', () => {
      expect(UndoManager.createStatusDescription(5, TaskStatus.InProgress)).toBe('Changed 5 tasks to InProgress');
    });
  });

  describe('complex undo/redo scenarios', () => {
    it('should handle multiple undo/redo cycles', () => {
      undoManager.recordOperation(createMockOperation('op-1'));
      undoManager.recordOperation(createMockOperation('op-2'));
      undoManager.recordOperation(createMockOperation('op-3'));

      // Undo all
      expect(undoManager.popForUndo()?.id).toBe('op-3');
      expect(undoManager.popForUndo()?.id).toBe('op-2');
      expect(undoManager.popForUndo()?.id).toBe('op-1');

      // All undone
      expect(undoManager.canUndo()).toBe(false);
      expect(undoManager.getRedoStackSize()).toBe(3);

      // Redo all
      expect(undoManager.popForRedo()?.id).toBe('op-1');
      expect(undoManager.popForRedo()?.id).toBe('op-2');
      expect(undoManager.popForRedo()?.id).toBe('op-3');

      expect(undoManager.canRedo()).toBe(false);
      expect(undoManager.getHistorySize()).toBe(3);
    });

    it('should handle partial undo followed by new operation', () => {
      undoManager.recordOperation(createMockOperation('op-1'));
      undoManager.recordOperation(createMockOperation('op-2'));
      undoManager.recordOperation(createMockOperation('op-3'));

      // Undo once
      undoManager.popForUndo();
      expect(undoManager.getHistorySize()).toBe(2);
      expect(undoManager.getRedoStackSize()).toBe(1);

      // Add new operation - should clear redo
      undoManager.recordOperation(createMockOperation('op-4'));
      expect(undoManager.getHistorySize()).toBe(3);
      expect(undoManager.getRedoStackSize()).toBe(0);
    });
  });

  describe('operations with different change types', () => {
    it('should record operation with task changes', () => {
      const taskChange: TaskChange = {
        taskId: 'todo-1',
        filePath: '/notes/test.md',
        lineNumber: 5,
        attributeName: 'due',
        previousValue: '2025-01-01',
        newValue: '2025-01-15',
      };

      const operation: UndoOperation = {
        id: 'test-op',
        timestamp: Date.now(),
        type: 'single',
        description: 'Moved task',
        taskChanges: [taskChange],
        statusChanges: [],
        tagChanges: [],
      };

      undoManager.recordOperation(operation);
      expect(undoManager.getLastOperation()?.taskChanges).toHaveLength(1);
    });

    it('should record operation with status changes', () => {
      const statusChange: StatusChange = {
        taskId: 'todo-1',
        filePath: '/notes/test.md',
        lineNumber: 5,
        previousStatus: TaskStatus.Todo,
        newStatus: TaskStatus.Complete,
        previousCompletedDate: undefined,
        newCompletedDate: '2025-01-15',
      };

      const operation: UndoOperation = {
        id: 'test-op',
        timestamp: Date.now(),
        type: 'single',
        description: 'Completed task',
        taskChanges: [],
        statusChanges: [statusChange],
        tagChanges: [],
      };

      undoManager.recordOperation(operation);
      expect(undoManager.getLastOperation()?.statusChanges).toHaveLength(1);
    });

    it('should record operation with tag changes', () => {
      const tagChange: TagChange = {
        taskId: 'todo-1',
        filePath: '/notes/test.md',
        lineNumber: 5,
        tag: 'urgent',
        action: 'added',
      };

      const operation: UndoOperation = {
        id: 'test-op',
        timestamp: Date.now(),
        type: 'single',
        description: 'Tagged task',
        taskChanges: [],
        statusChanges: [],
        tagChanges: [tagChange],
      };

      undoManager.recordOperation(operation);
      expect(undoManager.getLastOperation()?.tagChanges).toHaveLength(1);
    });

    it('should record batch operation with multiple changes', () => {
      const operation: UndoOperation = {
        id: 'batch-op',
        timestamp: Date.now(),
        type: 'batch',
        description: 'Moved 3 tasks',
        taskChanges: [
          { taskId: 'todo-1', filePath: '/notes/a.md', lineNumber: 1, attributeName: 'due', previousValue: undefined, newValue: '2025-01-15' },
          { taskId: 'todo-2', filePath: '/notes/b.md', lineNumber: 2, attributeName: 'due', previousValue: '2025-01-10', newValue: '2025-01-15' },
          { taskId: 'todo-3', filePath: '/notes/c.md', lineNumber: 3, attributeName: 'due', previousValue: '2025-01-05', newValue: '2025-01-15' },
        ],
        statusChanges: [],
        tagChanges: [],
      };

      undoManager.recordOperation(operation);
      const lastOp = undoManager.getLastOperation();
      expect(lastOp?.type).toBe('batch');
      expect(lastOp?.taskChanges).toHaveLength(3);
    });
  });
});

function createMockOperation(id: string, timestamp?: number): UndoOperation {
  return {
    id,
    timestamp: timestamp ?? Date.now(),
    type: 'single',
    description: `Test operation ${id}`,
    taskChanges: [],
    statusChanges: [],
    tagChanges: [],
  };
}
