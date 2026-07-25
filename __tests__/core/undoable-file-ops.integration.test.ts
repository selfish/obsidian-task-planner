import { UndoableFileOperations } from '../../src/core/operations/undoable-file-ops';
import { UndoManager } from '../../src/core/operations/undo-manager';
import { FollowUpCreator } from '../../src/core/services/follow-up-creator';
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

  it('finds the indexed task after a status write', async () => {
    const { task, undoManager, operations, findTask, content } = setup('- [ ] Task');

    await operations.batchUpdateTaskStatusWithUndo([task], TaskStatus.Complete, 'Complete task');
    const operation = undoManager.getLastOperation()!;

    expect(content()).toMatch(/^- \[x\] Task \[completed:: \d{4}-\d{2}-\d{2}\]$/);
    expect(await operations.applyUndo(operation, findTask)).toBe(true);
    expect(content()).toBe('- [ ] Task');
    expect(await operations.applyRedo(operation, findTask)).toBe(true);
    expect(content()).toMatch(/^- \[x\] Task \[completed:: \d{4}-\d{2}-\d{2}\]$/);
  });

  it('records a relocated status task identity for the reindexed task', async () => {
    const { task, undoManager, operations, content, replaceContent } = setup('- [ ] Task');
    replaceContent('Note\n- [ ] Task');

    await operations.batchUpdateTaskStatusWithUndo([task], TaskStatus.Complete, 'Complete task');
    const operation = undoManager.getLastOperation()!;
    const reindexedTask = { ...task, attributes: { ...task.attributes }, tags: [...(task.tags ?? [])] };
    const findReindexedTask = (id: string) => (getTaskId(reindexedTask) === id ? reindexedTask : undefined);

    expect(await operations.applyUndo(operation, findReindexedTask)).toBe(true);
    expect(content()).toBe('Note\n- [ ] Task');
  });

  it('fails closed after reindexing changes the recorded task identity', async () => {
    const { task, undoManager, operations, content, replaceContent } = setup('- [ ] Task');

    await operations.updateAttributeWithUndo(task, 'due', '2026-07-24', 'Schedule task');
    const operation = undoManager.getLastOperation()!;
    replaceContent(`Note\n${content()}`);
    task.line = 1;
    const findReindexedTask = (id: string, filePath?: string, sourceLine?: string) =>
      getTaskId(task) === id || (task.file.path === filePath && task.sourceLine === sourceLine) ? task : undefined;

    expect(await operations.applyUndo(operation, findReindexedTask)).toBe(false);
    expect(content()).toBe('Note\n- [ ] Task [due:: 2026-07-24]');
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

  it('undoes and redoes a combined move in one transaction each', async () => {
    const { task, undoManager, operations, findTask, content } = setup('- [ ] Task #old');
    const processContent = jest.fn(async (update: (current: string) => string) => {
      await task.file.setContent(update(content()));
    });
    task.file.processContent = processContent;
    await operations.combinedMoveWithUndo([task], 'due', '2026-07-24', 'new', TaskStatus.Complete, 'Move task', ['old']);
    const operation = undoManager.getLastOperation()!;

    processContent.mockClear();
    expect(await operations.applyUndo(operation, findTask)).toBe(true);
    expect(processContent).toHaveBeenCalledTimes(1);
    expect(content()).toBe('- [ ] Task #old');

    processContent.mockClear();
    expect(await operations.applyRedo(operation, findTask)).toBe(true);
    expect(processContent).toHaveBeenCalledTimes(1);
    expect(content()).toMatch(/^- \[x\] Task #new \[due:: 2026-07-24\] \[completed:: \d{4}-\d{2}-\d{2}\]$/);
  });

  it('writes every part of a combined move in one file transaction', async () => {
    const { task, operations, content } = setup('- [ ] Task #old');
    const processContent = jest.fn(async (update: (current: string) => string) => {
      const next = update(content());
      await task.file.setContent(next);
    });
    task.file.processContent = processContent;

    await operations.combinedMoveWithUndo([task], 'due', '2026-07-25', 'new', TaskStatus.Complete, 'Move task', ['old']);

    expect(processContent).toHaveBeenCalledTimes(1);
    expect(content()).toMatch(/^- \[x\] Task #new \[due:: 2026-07-25\] \[completed:: \d{4}-\d{2}-\d{2}\]$/);
  });

  it('records rapid moves in file order so the latest move can be undone', async () => {
    const { task, undoManager, operations, findTask, content } = setup('- [ ] Task');

    await Promise.all([
      operations.combinedMoveWithUndo([task], 'due', '2026-07-25', undefined, undefined, 'First move'),
      operations.combinedMoveWithUndo([task], 'due', '2026-07-26', undefined, undefined, 'Second move'),
    ]);

    expect(content()).toBe('- [ ] Task [due:: 2026-07-26]');
    expect(await operations.applyUndo(undoManager.popForUndo()!, findTask)).toBe(true);
    expect(content()).toBe('- [ ] Task [due:: 2026-07-25]');
  });

  it('records rapid status moves in file order so the latest move can be undone', async () => {
    const { task, undoManager, operations, findTask, content } = setup('- [ ] Task');

    await Promise.all([
      operations.batchUpdateTaskStatusWithUndo([task], TaskStatus.Complete, 'Complete task'),
      operations.batchUpdateTaskStatusWithUndo([task], TaskStatus.Canceled, 'Cancel task'),
    ]);

    expect(content()).toMatch(/^- \[-\] Task \[completed:: \d{4}-\d{2}-\d{2}\]$/);
    expect(await operations.applyUndo(undoManager.popForUndo()!, findTask)).toBe(true);
    expect(content()).toMatch(/^- \[x\] Task \[completed:: \d{4}-\d{2}-\d{2}\]$/);
  });

  it('records and undoes a concrete parent tag beside a nested child tag', async () => {
    const { task, undoManager, operations, findTask, content } = setup('- [ ] Task #inbox/to-read');
    task.tags = ['inbox', 'inbox/to-read'];

    await operations.combinedMoveWithUndo([task], 'due', '2026-08-01', 'inbox', undefined, 'Move task');

    expect(content()).toBe('- [ ] Task #inbox/to-read #inbox [due:: 2026-08-01]');
    expect(undoManager.getLastOperation()?.tagChanges).toHaveLength(1);
    expect(await operations.applyUndo(undoManager.getLastOperation()!, findTask)).toBe(true);
    expect(content()).toBe('- [ ] Task #inbox/to-read');
  });

  it('preserves hashtags inside metadata during a combined remove', async () => {
    const { task, undoManager, operations, findTask, content } = setup('- [ ] Task (note:: hello #work world)');

    await operations.combinedMoveWithUndo([task], 'due', '2026-08-01', undefined, undefined, 'Move task', ['work']);

    expect(content()).toBe('- [ ] Task (note:: hello #work world) [due:: 2026-08-01]');
    const operation = undoManager.getLastOperation()!;
    expect(operation.tagChanges).toEqual([]);
    expect(await operations.applyUndo(operation, findTask)).toBe(true);
    expect(content()).toBe('- [ ] Task (note:: hello #work world)');
  });

  it('restores the historical completion date when undoing a status change', async () => {
    const { task, undoManager, operations, findTask, content } = setup('- [x] Task [completed:: 2020-01-02]');
    task.status = TaskStatus.Todo;

    await operations.updateTaskStatusWithUndo(task, TaskStatus.Complete, 'Reopen task');
    expect(content()).toBe('- [ ] Task');

    expect(await operations.applyUndo(undoManager.getLastOperation()!, findTask)).toBe(true);
    expect(content()).toBe('- [x] Task [completed:: 2020-01-02]');
  });

  it('undoes an immediate status change after complete-and-follow-up', async () => {
    const { task, undoManager, operations, findTask, content } = setup('- [ ] Task');
    await new FollowUpCreator(DEFAULT_SETTINGS).createFollowUp(task, null, { completeOriginal: true });

    await operations.batchUpdateTaskStatusWithUndo([task], TaskStatus.Canceled, 'Cancel task');
    expect(await operations.applyUndo(undoManager.getLastOperation()!, findTask)).toBe(true);
    expect(content()).toMatch(/^- \[x\] Task \[completed:: \d{4}-\d{2}-\d{2}\]\n- \[ \] Follow up: Task$/);
  });

  it('fails closed instead of redirecting undo to a task matching stale history', async () => {
    const { task, undoManager, operations, content, replaceContent } = setup('- [ ] Task');

    await operations.updateAttributeWithUndo(task, 'due', '2026-07-25', 'Schedule task');
    const operation = undoManager.getLastOperation()!;
    replaceContent('inserted\n- [ ] Task [due:: 2026-07-26]\n- [ ] Task [due:: 2026-07-25]');
    task.line = 1;
    task.sourceLine = '- [ ] Task [due:: 2026-07-26]';
    task.attributes = { due: '2026-07-26' };
    const decoy = { ...task, line: 2, sourceLine: '- [ ] Task [due:: 2026-07-25]', attributes: { due: '2026-07-25' } };

    expect(await operations.applyUndo(operation, () => decoy)).toBe(false);
    expect(content()).toBe('inserted\n- [ ] Task [due:: 2026-07-26]\n- [ ] Task [due:: 2026-07-25]');
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

  it('rolls back a same-kind multi-file undo when one file conflicts', async () => {
    const first = setup('- [ ] First');
    const second = setup('- [ ] Second');
    second.task.file.id = 'file-2';
    second.task.file.path = 'other.md';

    await first.operations.batchUpdateAttributeWithUndo([first.task, second.task], 'due', '2026-08-01', 'Schedule tasks');
    const operation = first.undoManager.getLastOperation()!;
    second.replaceContent('- [ ] Second [due:: manual]');
    second.task.sourceLine = second.content();
    const findTask = (id: string) => [first.task, second.task].find((task) => getTaskId(task) === id);

    expect(await first.operations.applyUndo(operation, findTask)).toBe(false);
    expect(first.content()).toBe('- [ ] First [due:: 2026-08-01]');
    expect(second.content()).toBe('- [ ] Second [due:: manual]');
  });
});
