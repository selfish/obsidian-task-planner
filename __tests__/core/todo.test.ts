import { TodoStatus, TodoItem, getTodoId } from '../../src/types/todo';
import { FileAdapter } from '../../src/types/file-adapter';

// Mock FileAdapter
const createMockFileAdapter = (id: string, path: string): FileAdapter<unknown> => ({
  id,
  path,
  getContents: jest.fn().mockResolvedValue(''),
  save: jest.fn().mockResolvedValue(undefined),
  createOrSave: jest.fn().mockResolvedValue(undefined),
  file: {},
});

describe('TodoStatus', () => {
  it('should have correct enum values', () => {
    expect(TodoStatus.AttentionRequired).toBe(0);
    expect(TodoStatus.Todo).toBe(1);
    expect(TodoStatus.InProgress).toBe(2);
    expect(TodoStatus.Delegated).toBe(3);
    expect(TodoStatus.Complete).toBe(4);
    expect(TodoStatus.Canceled).toBe(5);
  });

  it('should allow numeric comparisons for ordering', () => {
    expect(TodoStatus.AttentionRequired < TodoStatus.Todo).toBe(true);
    expect(TodoStatus.Todo < TodoStatus.InProgress).toBe(true);
    expect(TodoStatus.InProgress < TodoStatus.Complete).toBe(true);
  });
});

describe('getTodoId', () => {
  it('should generate unique id from file, line, and text', () => {
    const todo: TodoItem<unknown> = {
      status: TodoStatus.Todo,
      text: 'Buy groceries',
      file: createMockFileAdapter('file-1', 'notes/todo.md'),
      line: 10,
    };

    const id = getTodoId(todo);
    expect(id).toBe('file-1-10-Buy groceries');
  });

  it('should handle missing line number', () => {
    const todo: TodoItem<unknown> = {
      status: TodoStatus.Todo,
      text: 'Task without line',
      file: createMockFileAdapter('file-2', 'notes/tasks.md'),
    };

    const id = getTodoId(todo);
    expect(id).toBe('file-2-0-Task without line');
  });

  it('should generate different ids for different todos', () => {
    const todo1: TodoItem<unknown> = {
      status: TodoStatus.Todo,
      text: 'First task',
      file: createMockFileAdapter('file-1', 'notes/todo.md'),
      line: 1,
    };

    const todo2: TodoItem<unknown> = {
      status: TodoStatus.Todo,
      text: 'Second task',
      file: createMockFileAdapter('file-1', 'notes/todo.md'),
      line: 2,
    };

    expect(getTodoId(todo1)).not.toBe(getTodoId(todo2));
  });

  it('should generate same id for same todo data', () => {
    const todoData = {
      status: TodoStatus.InProgress,
      text: 'Working on feature',
      file: createMockFileAdapter('file-3', 'project/tasks.md'),
      line: 42,
    };

    const todo1: TodoItem<unknown> = { ...todoData };
    const todo2: TodoItem<unknown> = { ...todoData };

    expect(getTodoId(todo1)).toBe(getTodoId(todo2));
  });
});

describe('TodoItem interface', () => {
  it('should support all optional properties', () => {
    const fullTodo: TodoItem<unknown> = {
      status: TodoStatus.Todo,
      text: 'Full featured task',
      file: createMockFileAdapter('file-1', 'notes/todo.md'),
      folderType: 'project',
      project: 'My Project',
      attributes: {
        due: '2025-01-15',
        priority: 'high',
        selected: true,
      },
      line: 5,
      subtasks: [],
    };

    expect(fullTodo.folderType).toBe('project');
    expect(fullTodo.project).toBe('My Project');
    expect(fullTodo.attributes?.due).toBe('2025-01-15');
    expect(fullTodo.attributes?.priority).toBe('high');
    expect(fullTodo.attributes?.selected).toBe(true);
    expect(fullTodo.subtasks).toEqual([]);
  });

  it('should support nested subtasks', () => {
    const parentTask: TodoItem<unknown> = {
      status: TodoStatus.InProgress,
      text: 'Parent task',
      file: createMockFileAdapter('file-1', 'notes/todo.md'),
      line: 1,
      subtasks: [
        {
          status: TodoStatus.Complete,
          text: 'Subtask 1',
          file: createMockFileAdapter('file-1', 'notes/todo.md'),
          line: 2,
        },
        {
          status: TodoStatus.Todo,
          text: 'Subtask 2',
          file: createMockFileAdapter('file-1', 'notes/todo.md'),
          line: 3,
        },
      ],
    };

    expect(parentTask.subtasks).toHaveLength(2);
    expect(parentTask.subtasks?.[0].status).toBe(TodoStatus.Complete);
    expect(parentTask.subtasks?.[1].status).toBe(TodoStatus.Todo);
  });
});
