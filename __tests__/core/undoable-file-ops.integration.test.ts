import { UndoableFileOperations } from '../../src/core/operations/undoable-file-ops';
import { UndoManager } from '../../src/core/operations/undo-manager';
import { DEFAULT_SETTINGS } from '../../src/settings/types';
import { FileAdapter } from '../../src/types/file-adapter';
import { getTaskId, TaskItem, TaskStatus } from '../../src/types/task';

function setup(content: string) {
  let currentContent = content;
  const file: FileAdapter<unknown> = {
    id: 'file-1',
    path: 'tasks.md',
    name: 'tasks.md',
    file: {},
    getContent: jest.fn(async () => currentContent),
    setContent: jest.fn(async (value: string) => {
      currentContent = value;
    }),
    isInFolder: jest.fn(() => false),
  };
  const task: TaskItem<unknown> = {
    status: TaskStatus.Todo,
    text: content.replace(/^- \[ \] /, ''),
    file,
    line: 0,
    sourceLine: content,
    tags: content.match(/#\w+/g)?.map((tag) => tag.slice(1)) ?? [],
    attributes: {},
  };
  const undoManager = new UndoManager({ enabled: true });
  const operations = new UndoableFileOperations({ settings: DEFAULT_SETTINGS, undoManager });
  const findTask = (id: string) => (getTaskId(task) === id ? task : undefined);
  return { task, undoManager, operations, findTask, content: () => currentContent, replaceContent: (value: string) => (currentContent = value) };
}

describe('UndoableFileOperations integration', () => {
  it('finds a tag-mutated task for immediate undo and redo', async () => {
    const { task, undoManager, operations, findTask, content } = setup('- [ ] Task');

    await operations.appendTagWithUndo(task, 'urgent', 'Tag task');
    const operation = undoManager.getLastOperation()!;

    expect(await operations.applyUndo(operation, findTask)).toBe(true);
    expect(content()).toBe('- [ ] Task');
    expect(await operations.applyRedo(operation, findTask)).toBe(true);
    expect(content()).toBe('- [ ] Task #urgent');
  });

  it('finds the indexed task when a status write uses a clone', async () => {
    const { task, undoManager, operations, findTask, content } = setup('- [ ] Task');
    const updatedTask = { ...task, status: TaskStatus.Complete };

    await operations.batchUpdateTaskStatusWithUndo([updatedTask], new Map([[getTaskId(task), task.status]]), 'Complete task');
    const operation = undoManager.getLastOperation()!;

    expect(content()).toMatch(/^- \[x\] Task \[completed:: \d{4}-\d{2}-\d{2}\]$/);
    expect(await operations.applyUndo(operation, findTask)).toBe(true);
    expect(content()).toBe('- [ ] Task');
    expect(await operations.applyRedo(operation, findTask)).toBe(true);
    expect(content()).toMatch(/^- \[x\] Task \[completed:: \d{4}-\d{2}-\d{2}\]$/);
  });

  it('finds a uniquely matching task after reindexing changes its line number', async () => {
    const { task, undoManager, operations, content, replaceContent } = setup('- [ ] Task');

    await operations.updateAttributeWithUndo(task, 'due', '2026-07-24', 'Schedule task');
    const operation = undoManager.getLastOperation()!;
    replaceContent(`Note\n${content()}`);
    task.line = 1;
    const findReindexedTask = (id: string, filePath?: string, sourceLine?: string) =>
      getTaskId(task) === id || (task.file.path === filePath && task.sourceLine === sourceLine) ? task : undefined;

    expect(await operations.applyUndo(operation, findReindexedTask)).toBe(true);
    expect(content()).toBe('Note\n- [ ] Task');
  });

  it('resolves every combined change before tag mutations alter identity', async () => {
    const { task, undoManager, operations, findTask, content } = setup('- [ ] Task #old');

    await operations.combinedMoveWithUndo([task], 'due', '2026-07-24', 'new', undefined, 'Move task', ['old']);
    const operation = undoManager.getLastOperation()!;

    expect(await operations.applyUndo(operation, findTask)).toBe(true);
    expect(content()).toBe('- [ ] Task #old');
    expect(await operations.applyRedo(operation, findTask)).toBe(true);
    expect(content()).toBe('- [ ] Task #new [due:: 2026-07-24]');
  });

  it('stops a combined undo after a conflict and keeps it on the undo stack', async () => {
    const { task, undoManager, operations, findTask, content, replaceContent } = setup('- [ ] Task');
    await operations.combinedMoveWithUndo([task], 'due', '2026-07-24', 'urgent', undefined, 'Move task');
    const operation = undoManager.popForUndo()!;
    const recordedSource = operation.taskChanges[0].sourceLine;
    replaceContent('- [ ] Task #urgent [due:: manual]');
    task.sourceLine = content();

    expect(await operations.applyUndo(operation, findTask)).toBe(false);
    expect(content()).toBe('- [ ] Task #urgent [due:: manual]');
    expect(operation.taskChanges[0].sourceLine).toBe(recordedSource);
    expect(undoManager.canUndo()).toBe(true);
    expect(undoManager.canRedo()).toBe(false);
  });

  it('stops a combined redo after a conflict and keeps it on the redo stack', async () => {
    const { task, undoManager, operations, findTask, content, replaceContent } = setup('- [ ] Task');
    await operations.combinedMoveWithUndo([task], 'due', '2026-07-24', 'urgent', undefined, 'Move task');
    expect(await operations.applyUndo(undoManager.popForUndo()!, findTask)).toBe(true);
    const operation = undoManager.popForRedo()!;
    replaceContent('- [ ] Task [due:: manual]');
    task.sourceLine = content();

    expect(await operations.applyRedo(operation, findTask)).toBe(false);
    expect(content()).toBe('- [ ] Task [due:: manual]');
    expect(undoManager.canUndo()).toBe(false);
    expect(undoManager.canRedo()).toBe(true);
  });
});
