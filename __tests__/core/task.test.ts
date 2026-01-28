import { TaskStatus, TaskItem, getTaskId } from '../../src/types/task';
import { FileAdapter } from '../../src/types/file-adapter';

const createMockFileAdapter = (id: string, path: string): FileAdapter<unknown> => ({
  id,
  path,
  getContents: jest.fn().mockResolvedValue(''),
  save: jest.fn().mockResolvedValue(undefined),
  createOrSave: jest.fn().mockResolvedValue(undefined),
  file: {},
});

describe('TaskStatus', () => {
  it('should have correct enum values', () => {
    expect(TaskStatus.AttentionRequired).toBe(0);
    expect(TaskStatus.Todo).toBe(1);
    expect(TaskStatus.InProgress).toBe(2);
    expect(TaskStatus.Delegated).toBe(3);
    expect(TaskStatus.Complete).toBe(4);
    expect(TaskStatus.Canceled).toBe(5);
  });

  it('should allow numeric comparisons for ordering', () => {
    expect(TaskStatus.AttentionRequired < TaskStatus.Todo).toBe(true);
    expect(TaskStatus.Todo < TaskStatus.InProgress).toBe(true);
    expect(TaskStatus.InProgress < TaskStatus.Complete).toBe(true);
  });
});

describe('getTaskId', () => {
  it('should generate unique id from file, line, and text', () => {
    const todo: TaskItem<unknown> = {
      status: TaskStatus.Todo,
      text: 'Buy groceries',
      file: createMockFileAdapter('file-1', 'notes/todo.md'),
      line: 10,
    };

    const id = getTaskId(todo);
    expect(id).toBe('file-1-10-Buy groceries');
  });

  it('should handle missing line number', () => {
    const todo: TaskItem<unknown> = {
      status: TaskStatus.Todo,
      text: 'Task without line',
      file: createMockFileAdapter('file-2', 'notes/tasks.md'),
    };

    const id = getTaskId(todo);
    expect(id).toBe('file-2-0-Task without line');
  });

  it('should generate different ids for different todos', () => {
    const todo1: TaskItem<unknown> = {
      status: TaskStatus.Todo,
      text: 'First task',
      file: createMockFileAdapter('file-1', 'notes/todo.md'),
      line: 1,
    };

    const todo2: TaskItem<unknown> = {
      status: TaskStatus.Todo,
      text: 'Second task',
      file: createMockFileAdapter('file-1', 'notes/todo.md'),
      line: 2,
    };

    expect(getTaskId(todo1)).not.toBe(getTaskId(todo2));
  });

  it('should generate same id for same todo data', () => {
    const todoData = {
      status: TaskStatus.InProgress,
      text: 'Working on feature',
      file: createMockFileAdapter('file-3', 'project/tasks.md'),
      line: 42,
    };

    const todo1: TaskItem<unknown> = { ...todoData };
    const todo2: TaskItem<unknown> = { ...todoData };

    expect(getTaskId(todo1)).toBe(getTaskId(todo2));
  });
});

describe('TaskItem interface', () => {
  it('should support all optional properties', () => {
    const fullTodo: TaskItem<unknown> = {
      status: TaskStatus.Todo,
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
    const parentTask: TaskItem<unknown> = {
      status: TaskStatus.InProgress,
      text: 'Parent task',
      file: createMockFileAdapter('file-1', 'notes/todo.md'),
      line: 1,
      subtasks: [
        {
          status: TaskStatus.Complete,
          text: 'Subtask 1',
          file: createMockFileAdapter('file-1', 'notes/todo.md'),
          line: 2,
        },
        {
          status: TaskStatus.Todo,
          text: 'Subtask 2',
          file: createMockFileAdapter('file-1', 'notes/todo.md'),
          line: 3,
        },
      ],
    };

    expect(parentTask.subtasks).toHaveLength(2);
    expect(parentTask.subtasks?.[0].status).toBe(TaskStatus.Complete);
    expect(parentTask.subtasks?.[1].status).toBe(TaskStatus.Todo);
  });
});
