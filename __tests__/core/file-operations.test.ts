import { FileOperations } from '../../src/core/operations/file-operations';
import { TaskItem, TaskStatus } from '../../src/types/task';
import { FileAdapter } from '../../src/types/file-adapter';
import { FileOperationError } from '../../src/lib/errors';

const createMockFileAdapter = (content: string, id = 'file-1'): FileAdapter<unknown> => {
  let currentContent = content;
  return {
    id,
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

const createTodo = (text: string, line: number, file: FileAdapter<unknown>, status = TaskStatus.Todo): TaskItem<unknown> => ({
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
      const todo: TaskItem<unknown> = {
        status: TaskStatus.Todo,
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

  describe('updateTaskStatus', () => {
    it('should update checkbox to completed [x]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TaskStatus.Complete);

      await operations.updateTaskStatus(todo, 'completed');

      // Single call updates both checkbox and completed attribute
      const calls = (file.setContent as jest.Mock).mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toContain('[x]');
    });

    it('should update checkbox to canceled [-]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TaskStatus.Canceled);

      await operations.updateTaskStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[-]');
    });

    it('should update checkbox to in progress [>]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TaskStatus.InProgress);

      await operations.updateTaskStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[>]');
    });

    it('should update checkbox to attention required [!]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TaskStatus.AttentionRequired);

      await operations.updateTaskStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[!]');
    });

    it('should update checkbox to delegated [d]', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TaskStatus.Delegated);

      await operations.updateTaskStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[d]');
    });

    it('should update checkbox to todo [ ]', async () => {
      const fileContent = '- [x] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TaskStatus.Todo);

      await operations.updateTaskStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('[ ]');
    });

    it('should add completed date when completing', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TaskStatus.Complete);

      await operations.updateTaskStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      // Single call includes both checkbox and completed attribute
      expect(calls[0][0]).toMatch(/\[completed:: \d{4}-\d{2}-\d{2}\]/);
    });

    it('should remove completed date when uncompleting', async () => {
      const fileContent = '- [x] Task [completed:: 2025-01-10]';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, TaskStatus.Todo);

      await operations.updateTaskStatus(todo, 'completed');

      const calls = (file.setContent as jest.Mock).mock.calls;
      // Single call handles both checkbox and completed attribute removal
      expect(calls[0][0]).not.toContain('[completed::');
    });

    it('should handle unknown status with empty checkbox', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todo = createTodo('Task', 0, file, 999 as TaskStatus);

      await operations.updateTaskStatus(todo, 'completed');

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
      const file2 = createMockFileAdapter('- [ ] Task two', 'file-2');
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

  describe('batchUpdateTaskStatus', () => {
    it('should update status for multiple todos', async () => {
      const fileContent = '- [ ] Task one\n- [ ] Task two';
      const file = createMockFileAdapter(fileContent);
      const todos = [
        createTodo('Task one', 0, file, TaskStatus.Complete),
        createTodo('Task two', 1, file, TaskStatus.Complete),
      ];

      await operations.batchUpdateTaskStatus(todos, 'completed');

      expect(file.setContent).toHaveBeenCalledTimes(1);
      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('- [x] Task one');
      expect(setContentCall).toContain('- [x] Task two');
    });

    it('should handle empty array', async () => {
      await operations.batchUpdateTaskStatus([], 'completed');
      // No errors should be thrown
    });

    it('should batch update to Todo status', async () => {
      const fileContent = '- [x] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TaskStatus.Todo)];

      await operations.batchUpdateTaskStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[ ]');
    });

    it('should batch update to Canceled status', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TaskStatus.Canceled)];

      await operations.batchUpdateTaskStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[-]');
    });

    it('should batch update to AttentionRequired status', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TaskStatus.AttentionRequired)];

      await operations.batchUpdateTaskStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[!]');
    });

    it('should batch update to Delegated status', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TaskStatus.Delegated)];

      await operations.batchUpdateTaskStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[d]');
    });

    it('should batch update to InProgress status', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TaskStatus.InProgress)];

      await operations.batchUpdateTaskStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('[>]');
    });

    it('should handle unknown status with empty checkbox', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, 999 as TaskStatus)];

      await operations.batchUpdateTaskStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      // Unknown status defaults to empty checkbox
      expect(setContentCall).toContain('- Task');
    });

    it('should skip todos with missing line numbers in batch', async () => {
      const fileContent = '- [ ] Task one\n- [ ] Task two';
      const file = createMockFileAdapter(fileContent);
      const todos = [
        createTodo('Task one', 0, file, TaskStatus.Complete),
        { status: TaskStatus.Complete, text: 'Task missing line', file, line: undefined } as TaskItem<unknown>,
      ];

      await operations.batchUpdateTaskStatus(todos, 'completed');

      // Should silently skip the todo without line number but still update the valid todo
      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('- [x] Task one');
    });

    it('should add completed date for completed status in batch', async () => {
      const fileContent = '- [ ] Task';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TaskStatus.Complete)];

      await operations.batchUpdateTaskStatus(todos, 'completed');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toMatch(/\[completed:: \d{4}-\d{2}-\d{2}\]/);
    });

    it('should remove completed date for non-completed status in batch', async () => {
      const fileContent = '- [x] Task [completed:: 2025-01-10]';
      const file = createMockFileAdapter(fileContent);
      const todos = [createTodo('Task', 0, file, TaskStatus.Todo)];

      await operations.batchUpdateTaskStatus(todos, 'completed');

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
      const todo: TaskItem<unknown> = {
        status: TaskStatus.Todo,
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
      const todo: TaskItem<unknown> = {
        status: TaskStatus.Todo,
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
      const todo: TaskItem<unknown> = {
        status: TaskStatus.Todo,
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
      const todo: TaskItem<unknown> = {
        status: TaskStatus.Todo,
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
      const todo: TaskItem<unknown> = {
        status: TaskStatus.Todo,
        text: 'Task one #work',
        file,
        line: 0,
        tags: ['work'],
      };

      await operations.removeTag(todo, 'work');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task one [due:: 2025-01-15]');
    });

    it('does not remove a hashtag from Dataview metadata variants', async () => {
      for (const metadata of ['[note:: hello #work world]', '(note:: #work)', '[note:: [[Page]] #work]']) {
        const file = createMockFileAdapter(`- [ ] Task one ${metadata}`);
        const todo: TaskItem<unknown> = {
          text: 'Task one',
          status: TaskStatus.Todo,
          file,
          line: 0,
          tags: ['work'],
          attributes: {},
          sourceLine: `- [ ] Task one ${metadata}`,
          sourceLineCount: 1,
        };

        await operations.removeTag(todo, 'work');

        expect(file.setContent).not.toHaveBeenCalled();
      }
    });

    it('should skip if todo does not have the tag', async () => {
      const fileContent = '- [ ] Task one';
      const file = createMockFileAdapter(fileContent);
      const todo: TaskItem<unknown> = {
        status: TaskStatus.Todo,
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
      const todo: TaskItem<unknown> = {
        status: TaskStatus.Todo,
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
      const todos: TaskItem<unknown>[] = [
        { status: TaskStatus.Todo, text: 'Task one #project', file, line: 0, tags: ['project'] },
        { status: TaskStatus.Todo, text: 'Task two', file, line: 1, tags: [] },
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
      const todos: TaskItem<unknown>[] = [
        { status: TaskStatus.Todo, text: 'Task one #project', file, line: 0, tags: ['project'] },
        { status: TaskStatus.Todo, text: 'Task two #project', file, line: 1, tags: ['project'] },
      ];

      await operations.batchAppendTag(todos, 'project');

      expect(file.setContent).not.toHaveBeenCalled();
    });

    it('should update todos in multiple files', async () => {
      const file1 = createMockFileAdapter('- [ ] Task one');
      const file2 = createMockFileAdapter('- [ ] Task two', 'file-2');
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
      const todos: TaskItem<unknown>[] = [
        createTodo('Task one', 0, file),
        { status: TaskStatus.Todo, text: 'Task missing line', file, line: undefined },
      ];

      await operations.batchAppendTag(todos, 'project');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toContain('- [ ] Task one #project');
    });
  });

  describe('stale task line protection', () => {
    it.each([
      ['attribute', (task: TaskItem<unknown>) => operations.updateAttribute(task, 'due', '2026-07-23'), '- [ ] Other\nInserted text\n- [ ] Target [due:: 2026-07-23]'],
      ['status', (task: TaskItem<unknown>) => operations.updateTaskStatus({ ...task, status: TaskStatus.InProgress }, 'completed'), '- [ ] Other\nInserted text\n- [>] Target'],
      ['tag', (task: TaskItem<unknown>) => operations.appendTag(task, 'work'), '- [ ] Other\nInserted text\n- [ ] Target #work'],
    ])('relocates a stale task before a single %s update', async (_name, update, expected) => {
      const file = createMockFileAdapter('- [ ] Other\nInserted text\n- [ ] Target');
      const task = createTodo('Target', 0, file);

      await update(task);

      expect((file.setContent as jest.Mock).mock.calls[0][0]).toBe(expected);
    });

    it.each([
      ['attribute', (tasks: TaskItem<unknown>[]) => operations.batchUpdateAttribute(tasks, 'due', '2026-07-23'), 'Inserted text\n- [ ] Target one [due:: 2026-07-23]\n- [ ] Target two [due:: 2026-07-23]'],
      ['status', (tasks: TaskItem<unknown>[]) => operations.batchUpdateTaskStatus(tasks.map((task) => ({ ...task, status: TaskStatus.InProgress })), 'completed'), 'Inserted text\n- [>] Target one\n- [>] Target two'],
      ['tag', (tasks: TaskItem<unknown>[]) => operations.batchAppendTag(tasks, 'work'), 'Inserted text\n- [ ] Target one #work\n- [ ] Target two #work'],
    ])('relocates stale tasks before a batch %s update', async (_name, update, expected) => {
      const file = createMockFileAdapter('Inserted text\n- [ ] Target one\n- [ ] Target two');
      const tasks = [createTodo('Target one', 0, file), createTodo('Target two', 1, file)];

      await update(tasks);

      expect((file.setContent as jest.Mock).mock.calls[0][0]).toBe(expected);
      expect(file.setContent).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['a deleted preceding line', '- [ ] Other\n- [ ] Target', 2, '- [ ] Other\n- [ ] Target [due:: 2026-07-23]'],
      ['reordered tasks', '- [ ] Other\n- [ ] Target', 0, '- [ ] Other\n- [ ] Target [due:: 2026-07-23]'],
    ])('relocates after %s', async (_scenario, content, staleLine, expected) => {
      const file = createMockFileAdapter(content);

      await operations.updateAttribute(createTodo('Target', staleLine, file), 'due', '2026-07-23');

      expect((file.setContent as jest.Mock).mock.calls[0][0]).toBe(expected);
    });

    it('keeps resolving a task across sequential tag and status updates', async () => {
      const file = createMockFileAdapter('Inserted text\n- [ ] Target');
      const task = { ...createTodo('Target', 0, file), tags: [] };

      await operations.appendTag(task, 'work');
      task.status = TaskStatus.InProgress;
      await operations.updateTaskStatus(task, 'completed');

      expect((file.setContent as jest.Mock).mock.calls[1][0]).toBe('Inserted text\n- [>] Target #work');
    });

    it('fails closed when duplicate task text is ambiguous', async () => {
      const file = createMockFileAdapter('- [ ] Same task\n- [ ] Same task');
      const task = createTodo('Same task', 0, file);

      await expect(operations.updateAttribute(task, 'due', '2026-07-23')).rejects.toThrow(/ambiguous/i);
      expect(file.setContent).not.toHaveBeenCalled();
    });

    it('fails closed when one of two originally identical tasks was deleted', async () => {
      const file = createMockFileAdapter('- [ ] Same task');
      const task = { ...createTodo('Same task', 0, file), sourceLine: '- [ ] Same task', sourceLineCount: 2 };

      await expect(operations.updateAttribute(task, 'due', '2026-07-23')).rejects.toThrow(/ambiguous/i);
      expect(file.setContent).not.toHaveBeenCalled();
    });

    it('does not confuse a deleted tagged task with a surviving tagged task', async () => {
      const file = createMockFileAdapter('- [ ] Deploy #home');
      const task = createTodo('Deploy #work', 0, file);

      await expect(operations.updateAttribute(task, 'due', '2026-07-23')).rejects.toThrow('Task not found');

      expect(file.setContent).not.toHaveBeenCalled();
    });

    it('does not confuse a deleted task with a same-text task carrying different metadata', async () => {
      const file = createMockFileAdapter('- [ ] Deploy [due:: 2026-07-24]');
      const task = { ...createTodo('Deploy', 0, file), sourceLine: '- [ ] Deploy [due:: 2026-07-23]' };

      await expect(operations.updateAttribute(task, 'priority', 'high')).rejects.toThrow('Task not found');

      expect(file.setContent).not.toHaveBeenCalled();
    });

    it('fails the whole batch before writing when a task is missing', async () => {
      const file = createMockFileAdapter('- [ ] Present task');
      const tasks = [createTodo('Present task', 0, file), createTodo('Deleted task', 1, file)];

      await expect(operations.batchAppendTag(tasks, 'work')).rejects.toThrow(/not found/i);
      expect(file.setContent).not.toHaveBeenCalled();
    });

    it('fails a multi-file batch before writing when another file is missing a task', async () => {
      const file1 = createMockFileAdapter('- [ ] Target one', 'file-1');
      const file2 = createMockFileAdapter('- [ ] Different task', 'file-2');
      const task1 = createTodo('Target one', 0, file1);
      const task2 = createTodo('Missing task', 0, file2);

      await expect(operations.batchUpdateAttribute([task1, task2], 'due', '2026-07-23')).rejects.toThrow('Task not found');

      expect(file1.setContent).not.toHaveBeenCalled();
      expect(file2.setContent).not.toHaveBeenCalled();
    });

    it('rolls back earlier files when a later batch write fails', async () => {
      const state = new Map([
        ['file-1', '- [ ] Target one'],
        ['file-2', '- [ ] Target two'],
      ]);
      const file1 = createMockFileAdapter(state.get('file-1')!, 'file-1');
      const file2 = createMockFileAdapter(state.get('file-2')!, 'file-2');
      file1.getContent = jest.fn(async () => state.get('file-1')!);
      file2.getContent = jest.fn(async () => state.get('file-2')!);
      file1.processContent = jest.fn(async (update) => {
        state.set('file-1', update(state.get('file-1')!));
      });
      file2.processContent = jest.fn().mockRejectedValue(new Error('write failed'));
      const task1 = { ...createTodo('Target one', 0, file1), sourceLine: '- [ ] Target one', sourceLineCount: 1, tags: [] };
      const task2 = { ...createTodo('Target two', 0, file2), sourceLine: '- [ ] Target two', sourceLineCount: 1, tags: [] };

      await expect(operations.batchAppendTag([task1, task2], 'work')).rejects.toMatchObject({
        context: expect.objectContaining({ originalError: 'write failed' }),
      });

      expect(state.get('file-1')).toBe('- [ ] Target one');
      expect(task1).toMatchObject({ text: 'Target one', sourceLine: '- [ ] Target one' });
    });

    it('does not overwrite an intervening edit during batch rollback', async () => {
      const state = new Map([
        ['file-1', '- [ ] Target one'],
        ['file-2', '- [ ] Target two'],
      ]);
      const file1 = createMockFileAdapter(state.get('file-1')!, 'file-1');
      const file2 = createMockFileAdapter(state.get('file-2')!, 'file-2');
      file1.getContent = jest.fn(async () => state.get('file-1')!);
      file2.getContent = jest.fn(async () => state.get('file-2')!);
      file1.processContent = jest.fn(async (update) => {
        state.set('file-1', update(state.get('file-1')!));
      });
      file2.processContent = jest.fn(async () => {
        state.set('file-1', `${state.get('file-1')}\nExternal edit`);
        throw new Error('write failed');
      });

      await expect(operations.batchAppendTag([createTodo('Target one', 0, file1), createTodo('Target two', 0, file2)], 'work')).rejects.toThrow('rollback was incomplete');

      expect(state.get('file-1')).toBe('- [ ] Target one #work\nExternal edit');
    });

    it('fails when one task is included twice in a batch', async () => {
      const file = createMockFileAdapter('- [ ] Target');
      const task = createTodo('Target', 0, file);

      await expect(operations.batchUpdateAttribute([task, task], 'due', '2026-07-23')).rejects.toThrow('Multiple updates resolved to the same task');

      expect(file.setContent).not.toHaveBeenCalled();
    });

    it.each([
      [new Error('process failed'), 'write'],
      [new FileOperationError('read failed', 'notes/todo.md', 'read'), 'read'],
    ])('preserves atomic processor error context', async (error, operation) => {
      const file = createMockFileAdapter('- [ ] Target') as FileAdapter<unknown> & { processContent: jest.Mock };
      file.processContent = jest.fn().mockRejectedValue(error);
      const task = createTodo('Target', 0, file);

      await expect(operations.updateAttribute(task, 'due', '2026-07-23')).rejects.toMatchObject({
        operation,
        context: expect.objectContaining({ lineNumber: 0, taskCount: 1 }),
      });
    });

    it('restores task identity when the atomic write fails', async () => {
      const file = createMockFileAdapter('Inserted\n- [ ] Target') as FileAdapter<unknown> & { processContent: jest.Mock };
      file.processContent = jest.fn(async (update) => {
        update('Inserted\n- [ ] Target');
        throw new Error('write failed');
      });
      const task = { ...createTodo('Target', 0, file), sourceLine: '- [ ] Target', sourceLineCount: 1, tags: [] };

      await expect(operations.appendTag(task, 'work')).rejects.toThrow(FileOperationError);

      expect(task).toMatchObject({ line: 0, text: 'Target', sourceLine: '- [ ] Target', sourceLineCount: 1, tags: [] });
    });

    it('uses current tag state instead of a stale task snapshot', async () => {
      const appendFile = createMockFileAdapter('- [ ] Target');
      const appendTask = { ...createTodo('Target', 0, appendFile), tags: ['fresh'] };
      await operations.appendTag(appendTask, 'fresh');
      expect(appendFile.setContent).toHaveBeenCalledWith('- [ ] Target #fresh');

      const removeFile = createMockFileAdapter('- [ ] Target #stale');
      const removeTask = { ...createTodo('Target #stale', 0, removeFile), tags: [] };
      await operations.batchRemoveTag([removeTask], 'stale');
      expect(removeFile.setContent).toHaveBeenCalledWith('- [ ] Target');
    });

    it('ignores task examples inside fenced code blocks when resolving identity', async () => {
      const file = createMockFileAdapter('```md\n- [ ] Target\n```\n- [ ] Target');
      const task = createTodo('Target', 3, file);

      await operations.updateAttribute(task, 'due', '2026-07-23');

      expect((file.setContent as jest.Mock).mock.calls[0][0]).toBe('```md\n- [ ] Target\n```\n- [ ] Target [due:: 2026-07-23]');
    });

    it('ignores task examples in fences under empty list items', async () => {
      const file = createMockFileAdapter('-\n    ```md\n    - [ ] Target\n    ```\n- [ ] Target');
      const task = createTodo('Target', 4, file);

      await operations.updateAttribute(task, 'due', '2026-07-23');

      expect(file.setContent).toHaveBeenCalledWith('-\n    ```md\n    - [ ] Target\n    ```\n- [ ] Target [due:: 2026-07-23]');
    });

    it('ignores task examples in tab-indented fences under empty list items', async () => {
      const file = createMockFileAdapter('-\t\n\t```md\n\t- [ ] Target\n\t```\n- [ ] Target');
      const task = createTodo('Target', 4, file);

      await operations.updateAttribute(task, 'due', '2026-07-23');

      expect(file.setContent).toHaveBeenCalledWith('-\t\n\t```md\n\t- [ ] Target\n\t```\n- [ ] Target [due:: 2026-07-23]');
    });

    it.each([
      ['- ```md\n  - [ ] Target\n  ```\n- [ ] Target', 3],
      ['1. ```md\n   - [ ] Target\n   ```\n1. [ ] Target', 3],
    ])('ignores task examples in fences opened on list markers', async (content, line) => {
      const file = createMockFileAdapter(content);
      const task = createTodo('Target', line, file);

      await operations.updateAttribute(task, 'due', '2026-07-23');

      expect(file.setContent).toHaveBeenCalledWith(`${content} [due:: 2026-07-23]`);
    });

    it('ignores task examples after a dedented fence ends a list container', async () => {
      const content = '- ```\n  code\n```\n- [ ] Target\n```\n- [ ] Target';
      const file = createMockFileAdapter(content);
      const task = createTodo('Target', 5, file);

      await operations.updateAttribute(task, 'due', '2026-07-23');

      expect(file.setContent).toHaveBeenCalledWith(`${content} [due:: 2026-07-23]`);
    });

    it('ignores task examples after excess list padding', async () => {
      const content = '-     item\n    ```\n    - [ ] Target\n    ```\n- [ ] Target';
      const file = createMockFileAdapter(content);
      const task = createTodo('Target', 4, file);

      await operations.updateAttribute(task, 'due', '2026-07-23');

      expect(file.setContent).toHaveBeenCalledWith(`${content} [due:: 2026-07-23]`);
    });

    it('ignores task examples in a list fence after lazy paragraph continuation', async () => {
      const content = '10. item\nlazy continuation\n    ```\n    - [ ] Target\n    ```\n- [ ] Target';
      const file = createMockFileAdapter(content);

      await operations.updateAttribute(createTodo('Target', 5, file), 'due', '2026-07-23');

      expect(file.setContent).toHaveBeenCalledWith(`${content} [due:: 2026-07-23]`);
    });

    it.each([
      ['blank lines', '- ```md\n  code\n\n  - [ ] Target\n  ```\n- [ ] Target', 5],
      ['post-marker tabs', '-\t\titem\n    ```\n    - [ ] Target\n    ```\n- [ ] Target', 4],
      ['nested list dedent', '- outer\n  - inner\n  ~~~md\n  - [ ] Target\n- [ ] Target', 4],
    ])('ignores task examples with %s in list-nested fences', async (_name, content, line) => {
      const file = createMockFileAdapter(content);
      const task = createTodo('Target', line, file);

      await operations.updateAttribute(task, 'due', '2026-07-23');

      expect(file.setContent).toHaveBeenCalledWith(`${content} [due:: 2026-07-23]`);
    });

    it.each([
      ['tilde', '~~~md\n- [ ] Target\n~~~\n- [ ] Target', '~~~md\n- [ ] Target\n~~~\n- [ ] Target [due:: 2026-07-23]'],
      ['long backtick', '````md\n- [ ] Target\n```\n````\n- [ ] Target', '````md\n- [ ] Target\n```\n````\n- [ ] Target [due:: 2026-07-23]'],
    ])('handles %s fences without matching task examples', async (_name, content, expected) => {
      const file = createMockFileAdapter(content);
      const task = createTodo('Target', content.split(/\r\n|\r|\n/).length - 1, file);

      await operations.updateAttribute(task, 'due', '2026-07-23');

      expect(file.setContent).toHaveBeenCalledWith(expected);
    });

    it('preserves mixed line endings and unrelated bytes exactly', async () => {
      const file = createMockFileAdapter('before\r\n- [ ] Target\ninside\r- [ ] Other');
      const task = createTodo('Target', 1, file);

      await operations.appendTag(task, 'work');

      expect((file.setContent as jest.Mock).mock.calls[0][0]).toBe('before\r\n- [ ] Target #work\ninside\r- [ ] Other');
    });

    it('preserves task spacing and unrelated metadata bytes', async () => {
      const content = '- [ ] Task   with   spacing [owner::   Alice  ]';
      const file = createMockFileAdapter(content);

      await operations.updateAttribute(createTodo('Task with spacing', 0, file), 'due', '2026-07-25');

      expect(file.setContent).toHaveBeenCalledWith(`${content} [due:: 2026-07-25]`);
    });

    it('uses an atomic content processor when the adapter provides one', async () => {
      const file = createMockFileAdapter('- [ ] Stale snapshot') as FileAdapter<unknown> & {
        processContent(update: (content: string) => string): Promise<void>;
      };
      file.processContent = jest.fn(async (update) => {
        update('Intervening edit\n- [ ] Target');
      });
      const task = createTodo('Target', 0, file);

      await operations.updateAttribute(task, 'due', '2026-07-23');

      expect(file.processContent).toHaveBeenCalledTimes(1);
      expect(file.getContent).not.toHaveBeenCalled();
      expect(file.setContent).not.toHaveBeenCalled();
    });
  });

  describe('batchRemoveTag', () => {
    it('should remove tag from multiple todos in the same file', async () => {
      const fileContent = '- [ ] Task one #work\n- [ ] Task two #work\n- [ ] Task three';
      const file = createMockFileAdapter(fileContent);
      const todos: TaskItem<unknown>[] = [
        { status: TaskStatus.Todo, text: 'Task one #work', file, line: 0, tags: ['work'] },
        { status: TaskStatus.Todo, text: 'Task two #work', file, line: 1, tags: ['work'] },
      ];

      await operations.batchRemoveTag(todos, 'work');

      expect(file.setContent).toHaveBeenCalledTimes(1);
      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task one\n- [ ] Task two\n- [ ] Task three');
    });

    it('should skip todos that do not have the tag', async () => {
      const fileContent = '- [ ] Task one #work\n- [ ] Task two';
      const file = createMockFileAdapter(fileContent);
      const todos: TaskItem<unknown>[] = [
        { status: TaskStatus.Todo, text: 'Task one #work', file, line: 0, tags: ['work'] },
        { status: TaskStatus.Todo, text: 'Task two', file, line: 1, tags: [] },
      ];

      await operations.batchRemoveTag(todos, 'work');

      expect(file.setContent).toHaveBeenCalledTimes(1);
      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task one\n- [ ] Task two');
    });

    it('should handle empty array', async () => {
      await operations.batchRemoveTag([], 'work');
      // No errors should be thrown
    });

    it('should skip if no todos have the tag', async () => {
      const fileContent = '- [ ] Task one\n- [ ] Task two';
      const file = createMockFileAdapter(fileContent);
      const todos: TaskItem<unknown>[] = [
        { status: TaskStatus.Todo, text: 'Task one', file, line: 0, tags: [] },
        { status: TaskStatus.Todo, text: 'Task two', file, line: 1, tags: [] },
      ];

      await operations.batchRemoveTag(todos, 'work');

      expect(file.setContent).not.toHaveBeenCalled();
    });

    it('should update todos in multiple files', async () => {
      const file1 = createMockFileAdapter('- [ ] Task one #shared');
      const file2 = createMockFileAdapter('- [ ] Task two #shared', 'file-2');
      const todos: TaskItem<unknown>[] = [
        { status: TaskStatus.Todo, text: 'Task one #shared', file: file1, line: 0, tags: ['shared'] },
        { status: TaskStatus.Todo, text: 'Task two #shared', file: file2, line: 0, tags: ['shared'] },
      ];

      await operations.batchRemoveTag(todos, 'shared');

      expect(file1.setContent).toHaveBeenCalledTimes(1);
      expect(file2.setContent).toHaveBeenCalledTimes(1);
      expect((file1.setContent as jest.Mock).mock.calls[0][0]).toBe('- [ ] Task one');
      expect((file2.setContent as jest.Mock).mock.calls[0][0]).toBe('- [ ] Task two');
    });

    it('should preserve other tags when removing one', async () => {
      const fileContent = '- [ ] Task one #work #urgent';
      const file = createMockFileAdapter(fileContent);
      const todos: TaskItem<unknown>[] = [
        { status: TaskStatus.Todo, text: 'Task one #work #urgent', file, line: 0, tags: ['work', 'urgent'] },
      ];

      await operations.batchRemoveTag(todos, 'work');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task one #urgent');
    });

    it('should preserve attributes when removing a tag', async () => {
      const fileContent = '- [ ] Task one #work [due:: 2025-01-15]';
      const file = createMockFileAdapter(fileContent);
      const todos: TaskItem<unknown>[] = [
        { status: TaskStatus.Todo, text: 'Task one #work', file, line: 0, tags: ['work'] },
      ];

      await operations.batchRemoveTag(todos, 'work');

      const setContentCall = (file.setContent as jest.Mock).mock.calls[0][0];
      expect(setContentCall).toBe('- [ ] Task one [due:: 2025-01-15]');
    });
  });

});
