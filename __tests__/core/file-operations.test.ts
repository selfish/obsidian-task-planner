import { FileOperations } from '../../src/core/operations/file-operations';
import { TodoItem, TodoStatus } from '../../src/types/todo';
import { FileAdapter } from '../../src/types/file-adapter';

const createMockFileAdapter = (content: string): FileAdapter<unknown> => {
  let currentContent = content;
  return {
    id: 'file-1',
    path: 'notes/todo.md',
    name: 'todo.md',
    getContentAsync: jest.fn().mockImplementation(() => Promise.resolve(currentContent)),
    setContentAsync: jest.fn().mockImplementation((newContent: string) => {
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

  describe('updateAttributeAsync', () => {
    it('should add an attribute to a todo', async () => {
      const fileContent = '- [ ] Task one\n- [ ] Task two\n- [ ] Task three';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task two', 1, file);

      await operations.updateAttributeAsync(todo, 'due', '2025-01-15');

      expect(file.setContentAsync).toHaveBeenCalled();
      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('- [ ] Task two [due:: 2025-01-15]');
    });

    it('should update an existing attribute', async () => {
      const fileContent = '- [ ] Task [due:: 2025-01-10]';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file);

      await operations.updateAttributeAsync(todo, 'due', '2025-01-20');

      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[due:: 2025-01-20]');
      expect(setContentCall).not.toContain('[due:: 2025-01-10]');
    });

    it('should remove an attribute when value is undefined', async () => {
      const fileContent = '- [ ] Task [due:: 2025-01-15]';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file);

      await operations.updateAttributeAsync(todo, 'due', undefined);

      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task');
    });

    it('should remove an attribute when value is false', async () => {
      const fileContent = '- [ ] Task [selected:: true]';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file);

      await operations.updateAttributeAsync(todo, 'selected', false);

      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
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

      await operations.updateAttributeAsync(todo, 'due', '2025-01-15');

      // Should silently skip - no file modification when line number is missing
      expect(file.setContentAsync).not.toHaveBeenCalled();
    });
  });

  describe('removeAttributeAsync', () => {
    it('should remove a specific attribute', async () => {
      const fileContent = '- [ ] Task [due:: 2025-01-15] [priority:: high]';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file);

      await operations.removeAttributeAsync(todo, 'due');

      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task [priority:: high]');
    });
  });

  describe('updateTodoStatus', () => {
    it('should update checkbox to completed [x]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.Complete);

      await operations.updateTodoStatus(todo, 'completed');

      // First call updates checkbox, second call updates completed attribute
      const calls = (file.setContentAsync as jest.Mock).mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[0][0]).toContain('[x]');
    });

    it('should update checkbox to canceled [-]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.Canceled);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContentAsync as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[-]');
    });

    it('should update checkbox to in progress [>]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.InProgress);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContentAsync as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[>]');
    });

    it('should update checkbox to attention required [!]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.AttentionRequired);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContentAsync as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[!]');
    });

    it('should update checkbox to delegated [d]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.Delegated);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContentAsync as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[d]');
    });

    it('should update checkbox to todo [ ]', async () => {
      const fileContent = '- [x] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.Todo);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContentAsync as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[ ]');
    });

    it('should add completed date when completing', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.Complete);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContentAsync as jest.Mock).mock.calls;
      // Second call adds the completed attribute
      expect(calls[1][0]).toMatch(/\[completed:: \d{4}-\d{2}-\d{2}\]/);
    });

    it('should remove completed date when uncompleting', async () => {
      const fileContent = '- [x] Task [completed:: 2025-01-10]';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TodoStatus.Todo);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContentAsync as jest.Mock).mock.calls;
      expect(calls[1][0]).not.toContain('[completed::');
    });

    it('should handle unknown status with empty checkbox', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, 999 as TodoStatus);

      await operations.updateTodoStatus(todo, 'completed');

      const calls = (file.setContentAsync as jest.Mock).mock.calls;
      // Unknown status results in empty checkbox string
      expect(calls[0][0]).toBe('- Task');
    });
  });

  describe('batchUpdateAttributeAsync', () => {
    it('should update multiple todos in the same file', async () => {
      const fileContent = '- [ ] Task one\n- [ ] Task two\n- [ ] Task three';
      const file = createMockFileAdapter(fileContent);
      const todos = [
        createTodo('Task one', 0, file),
        createTodo('Task two', 1, file),
      ];

      await operations.batchUpdateAttributeAsync(todos, 'priority', 'high');

      // Should only write to file once
      expect(file.setContentAsync).toHaveBeenCalledTimes(1);
      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('- [ ] Task one [priority:: high]');
      expect(setContentCall).toContain('- [ ] Task two [priority:: high]');
      expect(setContentCall).toContain('- [ ] Task three');
    });

    it('should handle empty array', async () => {
      await operations.batchUpdateAttributeAsync([], 'due', '2025-01-15');
      // No errors should be thrown
    });

    it('should update todos in multiple files', async () => {
      const file1 = createMockFileAdapter('- [ ] Task one');
      const file2 = createMockFileAdapter('- [ ] Task two');
      const todos = [
        createTodo('Task one', 0, file1),
        createTodo('Task two', 0, file2),
      ];

      await operations.batchUpdateAttributeAsync(todos, 'priority', 'high');

      expect(file1.setContentAsync).toHaveBeenCalledTimes(1);
      expect(file2.setContentAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('batchRemoveAttributeAsync', () => {
    it('should remove attribute from multiple todos', async () => {
      const fileContent = '- [ ] Task one [selected:: true]\n- [ ] Task two [selected:: true]';
      const file = createMockFileAdapter(fileContent);
      const todos = [
        createTodo('Task one', 0, file),
        createTodo('Task two', 1, file),
      ];

      await operations.batchRemoveAttributeAsync(todos, 'selected');

      expect(file.setContentAsync).toHaveBeenCalledTimes(1);
      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).not.toContain('[selected::');
    });

    it('should handle empty array', async () => {
      await operations.batchRemoveAttributeAsync([], 'due');
      // No errors should be thrown
    });
  });

  describe('batchUpdateTodoStatusAsync', () => {
    it('should update status for multiple todos', async () => {
      const fileContent = '- [ ] Task one\n- [ ] Task two';
      const file = createMockFileAdapter(fileContent);
      const todos = [
        createTodo('Task one', 0, file, TodoStatus.Complete),
        createTodo('Task two', 1, file, TodoStatus.Complete),
      ];

      await operations.batchUpdateTodoStatusAsync(todos, 'completed');

      expect(file.setContentAsync).toHaveBeenCalledTimes(1);
      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('- [x] Task one');
      expect(setContentCall).toContain('- [x] Task two');
    });

    it('should handle empty array', async () => {
      await operations.batchUpdateTodoStatusAsync([], 'completed');
      // No errors should be thrown
    });

    it('should batch update to Todo status', async () => {
      const fileContent = '- [x] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.Todo)];

      await operations.batchUpdateTodoStatusAsync(todos, 'completed');

      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[ ]');
    });

    it('should batch update to Canceled status', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.Canceled)];

      await operations.batchUpdateTodoStatusAsync(todos, 'completed');

      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[-]');
    });

    it('should batch update to AttentionRequired status', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.AttentionRequired)];

      await operations.batchUpdateTodoStatusAsync(todos, 'completed');

      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[!]');
    });

    it('should batch update to Delegated status', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.Delegated)];

      await operations.batchUpdateTodoStatusAsync(todos, 'completed');

      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[d]');
    });

    it('should batch update to InProgress status', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.InProgress)];

      await operations.batchUpdateTodoStatusAsync(todos, 'completed');

      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[>]');
    });

    it('should handle unknown status with empty checkbox', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, 999 as TodoStatus)];

      await operations.batchUpdateTodoStatusAsync(todos, 'completed');

      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
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

      await operations.batchUpdateTodoStatusAsync(todos, 'completed');

      // Should silently skip the todo without line number but still update the valid todo
      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('- [x] Task one');
    });

    it('should add completed date for completed status in batch', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.Complete)];

      await operations.batchUpdateTodoStatusAsync(todos, 'completed');

      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toMatch(/\[completed:: \d{4}-\d{2}-\d{2}\]/);
    });

    it('should remove completed date for non-completed status in batch', async () => {
      const fileContent = '- [x] Task [completed:: 2025-01-10]';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TodoStatus.Todo)];

      await operations.batchUpdateTodoStatusAsync(todos, 'completed');

      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).not.toContain('[completed::');
    });
  });

  describe('with Windows line endings', () => {
    it('should preserve CRLF line endings', async () => {
      const fileContent = '- [ ] Task one\r\n- [ ] Task two';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task one', 0, file);

      await operations.updateAttributeAsync(todo, 'due', '2025-01-15');

      const setContentCall = (file.setContentAsync as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('\r\n');
    });
  });

});
