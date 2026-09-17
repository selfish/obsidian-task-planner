import { App, Editor, TFile } from 'obsidian';
import { DueDateEditor, DueDateModal } from '../../src/ui/due-date-modal';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { serialize, deserialize } from 'node:v8';

// jsdom lacks structuredClone; use Node's real structured serialization.
beforeAll(() => { global.structuredClone = (value) => deserialize(serialize(value)); });
afterEach(() => document.body.replaceChildren());

function hostElement<T extends HTMLElement>(element: T): T {
  Object.assign(element, {
    addClass: (name: string) => element.classList.add(name),
    empty: () => element.replaceChildren(),
    createEl: (tag: string, options: any = {}) => {
      const child = hostElement(document.createElement(tag));
      if (options.text) child.textContent = options.text;
      if (options.cls) child.className = options.cls;
      if (options.type) child.setAttribute('type', options.type);
      for (const [name, value] of Object.entries(options.attr ?? {})) child.setAttribute(name, String(value));
      element.appendChild(child);
      return child;
    },
    createDiv: (options: any) => (element as any).createEl('div', options),
  });
  return element;
}

const settings = () => JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

describe('due date modal', () => {
  function setup(date?: string) {
    const apply = jest.fn();
    const modal = new DueDateModal(new App(), date, apply);
    modal.setTitle = jest.fn();
    hostElement(modal.contentEl);
    document.body.appendChild(modal.contentEl);
    modal.close = jest.fn(() => modal.onClose());
    modal.onOpen();
    const button = (label: string) => [...modal.contentEl.querySelectorAll('button')].find((node) => node.textContent === label)!;
    return { modal, apply, button };
  }

  it('renders the existing date and saves through a real submit button', () => {
    const { modal, apply, button } = setup('2026-09-17');
    const input = modal.contentEl.querySelector('input')!;
    expect(input.value).toBe('2026-09-17');
    expect(input.type).toBe('date');
    expect(button('Save').type).toBe('submit');
    input.value = '2026-12-25';
    button('Save').click();
    expect(apply).toHaveBeenCalledWith('2026-12-25');
    expect(modal.contentEl.children).toHaveLength(0);
  });

  it('cancels without applying and removes only with the explicit button', () => {
    const cancel = setup('2026-09-17');
    cancel.button('Cancel').click();
    expect(cancel.apply).not.toHaveBeenCalled();
    const remove = setup('2026-09-17');
    expect(remove.button('Remove date').type).toBe('button');
    remove.button('Remove date').click();
    expect(remove.apply).toHaveBeenCalledWith(null);
  });

  it('defaults to today, omits removal for an undated task, and rejects an empty date', () => {
    const { modal, button, apply } = setup();
    expect(modal.contentEl.querySelector('input')!.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(button('Remove date')).toBeUndefined();
    modal.contentEl.querySelector('input')!.value = '';
    modal.contentEl.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('due date editor safety', () => {
  let opened: DueDateModal;
  beforeEach(() => {
    jest.spyOn(DueDateModal.prototype, 'open').mockImplementation(function (this: DueDateModal) { opened = this; });
  });
  afterEach(() => jest.restoreAllMocks());

  function setup(text = '- [ ] Task [due:: 2026-09-17]', ch = 10) {
    const app = new App();
    const file = new TFile();
    let value = text;
    const editor = {
      getValue: jest.fn(() => value), getLine: jest.fn(() => value),
      getCursor: jest.fn(() => ({ line: 0, ch })),
      transaction: jest.fn(), focus: jest.fn(),
    } as unknown as Editor;
    (app.workspace as any).activeEditor = { editor, file };
    const config = settings();
    const controller = new DueDateEditor(app, () => config);
    return { app, file, editor, controller, config, change: (next: string) => { value = next; } };
  }

  function apply(date: string | null) { (opened as any).applyDate(date); }

  it.each([0, 10, 20, 27])('applies one narrow transaction and keeps the cursor on its task (%s)', (ch) => {
    const { controller, editor, file } = setup(undefined, ch);
    controller.open(editor, file);
    apply('2026-12-25');
    expect(editor.transaction).toHaveBeenCalledTimes(1);
    const transaction = (editor.transaction as jest.Mock).mock.calls[0][0];
    expect(transaction.changes).toHaveLength(1);
    expect(transaction.selection.from.line).toBe(0);
    expect(editor.focus).toHaveBeenCalled();
  });

  it('does not add an undo entry for an unchanged date', () => {
    const { controller, editor, file } = setup();
    controller.open(editor, file);
    apply('2026-09-17');
    expect(editor.transaction).not.toHaveBeenCalled();
    controller.close();
  });

  it.each(['text', 'file', 'editor', 'settings', 'closed'])('refuses a stale %s context', (reason) => {
    const { controller, app, editor, file, config, change } = setup();
    controller.open(editor, file);
    if (reason === 'text') change('Different content');
    if (reason === 'file') (app.workspace as any).activeEditor.file = new TFile();
    if (reason === 'editor') (app.workspace as any).activeEditor.editor = {};
    if (reason === 'settings') config.dueDateAttribute = 'deadline';
    if (reason === 'closed') (app.workspace as any).activeEditor = null;
    apply('2026-12-25');
    expect(editor.transaction).not.toHaveBeenCalled();

  });

  it('ignores non-task lines, and replaces an already open picker', () => {
    const ordinary = setup('ordinary text');
    ordinary.controller.open(ordinary.editor, ordinary.file);
    expect(DueDateModal.prototype.open).not.toHaveBeenCalled();
    const task = setup();
    task.controller.open(task.editor, task.file);
    const close = jest.spyOn(opened, 'close');
    task.controller.open(task.editor, task.file);
    expect(close).toHaveBeenCalled();
  });
});
