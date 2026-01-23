import { FileOperations } from '../../src/core/operations/file-operations';
import { TodoItem, TodoStatus } from '../../src/types/todo';
import { FileAdapter } from '../../src/types/file-adapter';
import { FileOperationError } from '../../src/lib/errors';

const createMockFileAdapter = (content: string): FileAdapter<unknown> => {
  let currentContent = content;
  return {
    id: 'file-1',
    path: 'notes/todo.md',
    name: 'todo.md',
    getContent: jest.fn().mockImplementation(() => Promise.resolve(currentContent)),
    setContent: jest.fn().mockImplementation((newContent: string) => {
      currentContent = newContent;
      return Promise.resolve();
    }),
    createOrSave: jest.fn().mockResolvedValue(undefined),
    isInFolder: jest.fn().mockReturnValue(false),
    file: {},
  };
};

const createTodo = (text: string, line: number, file: FileAdapter<unknown>, status = TodoStatus.Todo): TodoItem<unknown> => ({
  status,
  text,
  file,
  line,
});

describe('FileOperations', () => {
  let operations: FileOperations;

  beforeEach(() => {
    operations = new FileOperations();
  });

  describe('updateAttribute', () => {
    it('should add an attribute to a todo', async () => {
      const fileContent = '- [ ] Task one\n- [ ] Task two\n- [ ] Task three';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task two', 1, file);

      await operations.updateAttribute(todo, 'due', '2025-01-15');

      expect(file.setContent).toHaveBeenCalled();
      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('- [ ] Task two [due:: 2025-01-15]');
    });

    it('should update an existing attribute', async () => {
      const fileContent = '- [ ] Task [due:: 2025-01-10]';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file);

      await operations.updateAttribute(todo, 'due', '2025-01-20');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[due:: 2025-01-20]');
      expect(setContentCall).not.toContain('[due:: 2025-01-10]');
    });

    it('should remove an attribute when value is undefined', async () => {
      const fileContent = '- [ ] Task [due:: 2025-01-15]';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file);

      await operations.updateAttribute(todo, 'due', undefined);

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task');
    });

    it('should remove an attribute when value is false', async () => {
      const fileContent = '- [ ] Task [selected:: true]';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file);

      await operations.updateAttribute(todo, 'selected', false);

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task');
    });

    it('should handle todo without line number', async () => {
      const file = createMockFileAdapter('- [ ] Task');
      const todo: TodoItem<unknown> = {
        status: TodoStatus.Todo,
        text: 'Task',
        file,
        line: undefined,
      };

      await operations.updateAttribute(todo, 'due', '2025-01-15');

      // Should silently skip - no file modification when line number is missing
      expect(file.setContent).not.toHaveBeenCalled();
    });

    it('should throw FileOperationError when getContent fails', async () => {
      const file = createMockFileAdapter('- [ ] Task');
      const readError = new Error('Permission denied');
      (file.getContent as jest.Mock).mockRejectedValue(readError);
      const todo = createTodo('Task', 0, file);

      await expect(operations.updateAttribute(todo, 'due', '2025-01-15')).rejects.toThrow(FileOperationError);
      await expect(operations.updateAttribute(todo, 'due', '2025-01-15')).rejects.toMatchObject({
        filePath: 'notes/todo.md',
        operation: 'read',
        tier: 'HIGH',
      });
    });

    it('should throw FileOperationError when getContent fails with non-Error', async () => {
      const file = createMockFileAdapter('- [ ] Task');
      (file.getContent as jest.Mock).mockRejectedValue('String error');
      const todo = createTodo('Task', 0, file);

      await expect(operations.updateAttribute(todo, 'due', '2025-01-15')).rejects.toThrow(FileOperationError);
    });

    it('should throw FileOperationError when setContent fails', async () => {
      const file = createMockFileAdapter('- [ ] Task');
      const writeError = new Error('Disk full');
      (file.setContent as jest.Mock).mockRejectedValue(writeError);
      const todo = createTodo('Task', 0, file);

      await expect(operations.updateAttribute(todo, 'due', '2025-01-15')).rejects.toThrow(FileOperationError);
      await expect(operations.updateAttribute(todo, 'due', '2025-01-15')).rejects.toMatchObject({
        filePath: 'notes/todo.md',
        operation: 'write',
        tier: 'HIGH',
      });
    });

    it('should throw FileOperationError when setContent fails with non-Error', async () => {
      const file = createMockFileAdapter('- [ ] Task');
      (file.setContent as jest.Mock).mockRejectedValue('String error');
      const todo = createTodo('Task', 0, file);

      await expect(operations.updateAttribute(todo, 'due', '2025-01-15')).rejects.toThrow(FileOperationError);
    });
  });

  describe('removeAttribute', () => {
    it('should remove a specific attribute', async () => {
      const fileContent = '- [ ] Task [due:: 2025-01-15] [priority:: high]';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file);

      await operations.removeAttribute(todo, 'due');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task [priority:: high]');
    });
  });

  describe('updateTodoStatus', () => {
    it('should update checkbox to completed [x]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.Complete);

      await operations.updateTodoStatus(todo, 'completed');

      // Single call updates both checkbox and completed attribute
      const calls = (file.setContent as jest.Mock).mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toContain('[x]');
    });

    it('should update checkbox to canceled [-]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.Canceled);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[-]');
    });

    it('should update checkbox to in progress [>]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.InProgress);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[>]');
    });

    it('should update checkbox to attention required [!]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.AttentionRequired);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[!]');
    });

    it('should update checkbox to delegated [d]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.Delegated);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[d]');
    });

    it('should update checkbox to todo [ ]', async () => {
      const fileContent = '- [x] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.Todo);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[ ]');
    });

    it('should add completed date when completing', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.Complete);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      // Single call includes both checkbox and completed attribute
      expect(calls[0][0]).toMatch(/\[completed:: \d{4}-\d{2}-\d{2}\]/);
    });

    it('should remove completed date when uncompleting', async () => {
      const fileContent = '- [x] Task [completed:: 2025-01-10]';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.Todo);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      // Single call handles both checkbox and completed attribute removal
      expect(calls[0][0]).not.toContain('[completed::');
    });

    it('should handle unknown status with empty checkbox', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, 999 as TodoStatus);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      // Unknown status results in empty checkbox string
      expect(calls[0][0]).toBe('- Task');
    });
  });

  describe('batchUpdateAttribute', () => {
    it('should update multiple todos in the same file', async () => {
      const fileContent = '- [ ] Task one\n- [ ] Task two\n- [ ] Task three';
      const file = createMockFileAdapter(fileContent);
      const todos = [
        createTodo('Task one', 0, file),
        createTodo('Task two', 1, file),
      ];

      await operations.batchUpdateAttribute(todos, 'priority', 'high');

      // Should only write to file once
      expect(file.setContent).toHaveBeenCalledTimes(1);
      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('- [ ] Task one [priority:: high]');
      expect(setContentCall).toContain('- [ ] Task two [priority:: high]');
      expect(setContentCall).toContain('- [ ] Task three');
    });

    it('should handle empty array', async () => {
      await operations.batchUpdateAttribute([], 'due', '2025-01-15');
      // No errors should be thrown
    });

    it('should update todos in multiple files', async () => {
      const file1 = createMockFileAdapter('- [ ] Task one');
      const file2 = createMockFileAdapter('- [ ] Task two');
      const todos = [
        createTodo('Task one', 0, file1),
        createTodo('Task two', 0, file2),
      ];

      await operations.batchUpdateAttribute(todos, 'priority', 'high');

      expect(file1.setContent).toHaveBeenCalledTimes(1);
      expect(file2.setContent).toHaveBeenCalledTimes(1);
    });

    it('should remove attribute when value is undefined in batch', async () => {
      const fileContent = '- [ ] Task one [priority:: high]\n- [ ] Task two [priority:: high]';
      const file = createMockFileAdapter(fileContent);
      const todos = [
        createTodo('Task one', 0, file),
        createTodo('Task two', 1, file),
      ];

      await operations.batchUpdateAttribute(todos, 'priority', undefined);

      expect(file.setContent).toHaveBeenCalledTimes(1);
      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task one\n- [ ] Task two');
    });

    it('should remove attribute when value is false in batch', async () => {
      const fileContent = '- [ ] Task one [selected:: true]\n- [ ] Task two [selected:: true]';
      const file = createMockFileAdapter(fileContent);
      const todos = [
        createTodo('Task one', 0, file),
        createTodo('Task two', 1, file),
      ];

      await operations.batchUpdateAttribute(todos, 'selected', false);

      expect(file.setContent).toHaveBeenCalledTimes(1);
      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task one\n- [ ] Task two');
    });

    it('should throw FileOperationError when getContent fails in batch', async () => {
      const file = createMockFileAdapter('- [ ] Task one\n- [ ] Task two');
      const readError = new Error('Permission denied');
      (file.getContent as jest.Mock).mockRejectedValue(readError);
      const todos = [
        createTodo('Task one', 0, file),
        createTodo('Task two', 1, file),
      ];

      await expect(operations.batchUpdateAttribute(todos, 'priority', 'high')).rejects.toThrow(FileOperationError);
      await expect(operations.batchUpdateAttribute(todos, 'priority', 'high')).rejects.toMatchObject({
        filePath: 'notes/todo.md',
        operation: 'read',
        tier: 'HIGH',
      });
    });

    it('should throw FileOperationError when getContent fails with non-Error in batch', async () => {
      const file = createMockFileAdapter('- [ ] Task one\n- [ ] Task two');
      (file.getContent as jest.Mock).mockRejectedValue('String error');
      const todos = [
        createTodo('Task one', 0, file),
        createTodo('Task two', 1, file),
      ];

      await expect(operations.batchUpdateAttribute(todos, 'priority', 'high')).rejects.toThrow(FileOperationError);
    });

    it('should throw FileOperationError when setContent fails in batch', async () => {
      const file = createMockFileAdapter('- [ ] Task one\n- [ ] Task two');
      const writeError = new Error('Disk full');
      (file.setContent as jest.Mock).mockRejectedValue(writeError);
      const todos = [
        createTodo('Task one', 0, file),
        createTodo('Task two', 1, file),
      ];

      await expect(operations.batchUpdateAttribute(todos, 'priority', 'high')).rejects.toThrow(FileOperationError);
      await expect(operations.batchUpdateAttribute(todos, 'priority', 'high')).rejects.toMatchObject({
        filePath: 'notes/todo.md',
        operation: 'write',
        tier: 'HIGH',
      });
    });

    it('should throw FileOperationError when setContent fails with non-Error in batch', async () => {
      const file = createMockFileAdapter('- [ ] Task one\n- [ ] Task two');
      (file.setContent as jest.Mock).mockRejectedValue('String error');
      const todos = [
        createTodo('Task one', 0, file),
        createTodo('Task two', 1, file),
      ];

      await expect(operations.batchUpdateAttribute(todos, 'priority', 'high')).rejects.toThrow(FileOperationError);
    });
  });

  describe('batchRemoveAttribute', () => {
    it('should remove attribute from multiple todos', async () => {
      const fileContent = '- [ ] Task one [selected:: true]\n- [ ] Task two [selected:: true]';
      const file = createMockFileAdapter(fileContent);
      const todos = [
        createTodo('Task one', 0, file),
        createTodo('Task two', 1, file),
      ];

      await operations.batchRemoveAttribute(todos, 'selected');

      expect(file.setContent).toHaveBeenCalledTimes(1);
      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).not.toContain('[selected::');
    });

    it('should handle empty array', async () => {
      await operations.batchRemoveAttribute([], 'due');
      // No errors should be thrown
    });
  });

  describe('batchUpdateTodoStatus', () => {
    it('should update status for multiple todos', async () => {
      const fileContent = '- [ ] Task one\n- [ ] Task two';
      const file = createMockFileAdapter(fileContent);
      const todos = [
        createTodo('Task one', 0, file, TodoStatus.Complete),
        createTodo('Task two', 1, file, TodoStatus.Complete),
      ];

      await operations.batchUpdateTodoStatus(todos, 'completed');

      expect(file.setContent).toHaveBeenCalledTimes(1);
      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('- [x] Task one');
      expect(setContentCall).toContain('- [x] Task two');
    });

    it('should handle empty array', async () => {
      await operations.batchUpdateTodoStatus([], 'completed');
      // No errors should be thrown
    });

    it('should batch update to Todo status', async () => {
      const fileContent = '- [x] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.Todo)];

      await operations.batchUpdateTodoStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[ ]');
    });

    it('should batch update to Canceled status', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.Canceled)];

      await operations.batchUpdateTodoStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[-]');
    });

    it('should batch update to AttentionRequired status', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.AttentionRequired)];

      await operations.batchUpdateTodoStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[!]');
    });

    it('should batch update to Delegated status', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.Delegated)];

      await operations.batchUpdateTodoStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[d]');
    });

    it('should batch update to InProgress status', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.InProgress)];

      await operations.batchUpdateTodoStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[>]');
    });

    it('should handle unknown status with empty checkbox', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, 999 as TodoStatus)];

      await operations.batchUpdateTodoStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      // Unknown status defaults to empty checkbox
      expect(setContentCall).toContain('- Task');
    });

    it('should skip todos with missing line numbers in batch', async () => {
      const fileContent = '- [ ] Task one\n- [ ] Task two';
      const file = createMockFileAdapter(fileContent);
      const todos = [
        createTodo('Task one', 0, file, TodoStatus.Complete),
        { status: TodoStatus.Complete, text: 'Task missing line', file, line: undefined } as TodoItem<unknown>,
      ];

      await operations.batchUpdateTodoStatus(todos, 'completed');

      // Should silently skip the todo without line number but still update the valid todo
      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('- [x] Task one');
    });

    it('should add completed date for completed status in batch', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.Complete)];

      await operations.batchUpdateTodoStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toMatch(/\[completed:: \d{4}-\d{2}-\d{2}\]/);
    });

    it('should remove completed date for non-completed status in batch', async () => {
      const fileContent = '- [x] Task [completed:: 2025-01-10]';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.Todo)];

      await operations.batchUpdateTodoStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).not.toContain('[completed::');
    });
  });

  describe('with Windows line endings', () => {
    it('should preserve CRLF line endings', async () => {
      const fileContent = '- [ ] Task one\r\n- [ ] Task two';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task one', 0, file);

      await operations.updateAttribute(todo, 'due', '2025-01-15');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('\r\n');
    });
  });

  describe('appendTag', () => {
    it('should append a tag to a todo', async () => {
      const fileContent = '- [ ] Task one';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task one', 0, file);

      await operations.appendTag(todo, 'work');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task one #work');
    });

    it('should append a tag while preserving existing attributes', async () => {
      const fileContent = '- [ ] Task one [due:: 2025-01-15]';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task one', 0, file);

      await operations.appendTag(todo, 'urgent');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task one #urgent [due:: 2025-01-15]');
    });

    it('should skip if todo already has the tag', async () => {
      const fileContent = '- [ ] Task one #work';
      const file = createMockFileAdapter(fileContent);
      const todo: TodoItem<unknown> = {
        status: TodoStatus.Todo,
        text: 'Task one #work',
        file,
        line: 0,
        tags: ['work'],
      };

      await operations.appendTag(todo, 'work');

      expect(file.setContent).not.toHaveBeenCalled();
    });

    it('should handle todo without line number', async () => {
      const file = createMockFileAdapter('- [ ] Task');
      const todo: TodoItem<unknown> = {
        status: TodoStatus.Todo,
        text: 'Task',
        file,
        line: undefined,
      };

      await operations.appendTag(todo, 'test');

      expect(file.setContent).not.toHaveBeenCalled();
    });
  });

  describe('removeTag', () => {
    it('should remove a tag from a todo', async () => {
      const fileContent = '- [ ] Task one #work';
      const file = createMockFileAdapter(fileContent);
      const todo: TodoItem<unknown> = {
        status: TodoStatus.Todo,
        text: 'Task one #work',
        file,
        line: 0,
        tags: ['work'],
      };

      await operations.removeTag(todo, 'work');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task one');
    });

    it('should remove only the specified tag when multiple tags exist', async () => {
      const fileContent = '- [ ] Task one #work #urgent';
      const file = createMockFileAdapter(fileContent);
      const todo: TodoItem<unknown> = {
        status: TodoStatus.Todo,
        text: 'Task one #work #urgent',
        file,
        line: 0,
        tags: ['work', 'urgent'],
      };

      await operations.removeTag(todo, 'work');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task one #urgent');
    });

    it('should preserve attributes when removing a tag', async () => {
      const fileContent = '- [ ] Task one #work [due:: 2025-01-15]';
      const file = createMockFileAdapter(fileContent);
      const todo: TodoItem<unknown> = {
        status: TodoStatus.Todo,
        text: 'Task one #work',
        file,
        line: 0,
        tags: ['work'],
      };

      await operations.removeTag(todo, 'work');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task one [due:: 2025-01-15]');
    });

    it('should skip if todo does not have the tag', async () => {
      const fileContent = '- [ ] Task one';
      const file = createMockFileAdapter(fileContent);
      const todo: TodoItem<unknown> = {
        status: TodoStatus.Todo,
        text: 'Task one',
        file,
        line: 0,
        tags: [],
      };

      await operations.removeTag(todo, 'work');

      expect(file.setContent).not.toHaveBeenCalled();
    });

    it('should skip if todo has undefined tags', async () => {
      const fileContent = '- [ ] Task one';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task one', 0, file);

      await operations.removeTag(todo, 'work');

      expect(file.setContent).not.toHaveBeenCalled();
    });

    it('should handle todo without line number', async () => {
      const file = createMockFileAdapter('- [ ] Task #work');
      const todo: TodoItem<unknown> = {
        status: TodoStatus.Todo,
        text: 'Task #work',
        file,
        line: undefined,
        tags: ['work'],
      };

      await operations.removeTag(todo, 'work');

      expect(file.setContent).not.toHaveBeenCalled();
    });
  });

  describe('batchAppendTag', () => {
    it('should append tag to multiple todos in the same file', async () => {
      const fileContent = '- [ ] Task one\n- [ ] Task two\n- [ ] Task three';
      const file = createMockFileAdapter(fileContent);
      const todos = [
        createTodo('Task one', 0, file),
        createTodo('Task two', 1, file),
      ];

      await operations.batchAppendTag(todos, 'project');

      expect(file.setContent).toHaveBeenCalledTimes(1);
      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('- [ ] Task one #project');
      expect(setContentCall).toContain('- [ ] Task two #project');
      expect(setContentCall).toContain('- [ ] Task three');
    });

    it('should skip todos that already have the tag', async () => {
      const fileContent = '- [ ] Task one #project\n- [ ] Task two';
      const file = createMockFileAdapter(fileContent);
      const todos: TodoItem<unknown>[] = [
        { status: TodoStatus.Todo, text: 'Task one #project', file, line: 0, tags: ['project'] },
        { status: TodoStatus.Todo, text: 'Task two', file, line: 1, tags: [] },
      ];

      await operations.batchAppendTag(todos, 'project');

      expect(file.setContent).toHaveBeenCalledTimes(1);
      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      // First task should not get double tag
      expect(setContentCall).toBe('- [ ] Task one #project\n- [ ] Task two #project');
    });

    it('should handle empty array', async () => {
      await operations.batchAppendTag([], 'project');
      // No errors should be thrown
    });

    it('should skip if all todos already have the tag', async () => {
      const fileContent = '- [ ] Task one #project\n- [ ] Task two #project';
      const file = createMockFileAdapter(fileContent);
      const todos: TodoItem<unknown>[] = [
        { status: TodoStatus.Todo, text: 'Task one #project', file, line: 0, tags: ['project'] },
        { status: TodoStatus.Todo, text: 'Task two #project', file, line: 1, tags: ['project'] },
      ];

      await operations.batchAppendTag(todos, 'project');

      expect(file.setContent).not.toHaveBeenCalled();
    });

    it('should update todos in multiple files', async () => {
      const file1 = createMockFileAdapter('- [ ] Task one');
      const file2 = createMockFileAdapter('- [ ] Task two');
      const todos = [
        createTodo('Task one', 0, file1),
        createTodo('Task two', 0, file2),
      ];

      await operations.batchAppendTag(todos, 'shared');

      expect(file1.setContent).toHaveBeenCalledTimes(1);
      expect(file2.setContent).toHaveBeenCalledTimes(1);
      expect((file1.setContent as jest.Mock).mock.calls[0][0]).toContain('#shared');
      expect((file2.setContent as jest.Mock).mock.calls[0][0]).toContain('#shared');
    });

    it('should skip todos with missing line numbers', async () => {
      const fileContent = '- [ ] Task one\n- [ ] Task two';
      const file = createMockFileAdapter(fileContent);
      const todos: TodoItem<unknown>[] = [
        createTodo('Task one', 0, file),
        { status: TodoStatus.Todo, text: 'Task missing line', file, line: undefined },
      ];

      await operations.batchAppendTag(todos, 'project');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('- [ ] Task one #project');
    });
  });

});
