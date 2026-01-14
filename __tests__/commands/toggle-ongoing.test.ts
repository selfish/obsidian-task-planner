import { ToggleOngoingTodoCommand } from '../../src/commands/toggle-ongoing';
import { StatusOperations } from '../../src/core/operations/status-operations';
import { Editor, MarkdownView } from 'obsidian';

const createMockEditor = (lines: string[]): Editor => {
  let currentLines = [...lines];
  return {
    getCursor: jest.fn().mockReturnValue({ line: 0, ch: 0 }),
    getLine: jest.fn().mockImplementation((lineNumber: number) => currentLines[lineNumber]),
    setLine: jest.fn().mockImplementation((lineNumber: number, text: string) => {
      currentLines[lineNumber] = text;
    }),
  } as unknown as Editor;
};

describe('ToggleOngoingTodoCommand', () => {
  let statusOperations: StatusOperations;
  let command: ToggleOngoingTodoCommand;

  beforeEach(() => {
    statusOperations = new StatusOperations();
    command = new ToggleOngoingTodoCommand(statusOperations);
  });

  describe('properties', () => {
    it('should have correct id', () => {
      expect(command.id).toBe('task-planner.toggle-ongoing-todo');
    });

    it('should have correct name', () => {
      expect(command.name).toBe('Mark todo as ongoing / unchecked');
    });

    it('should have correct icon', () => {
      expect(command.icon).toBe('clock');
    });
  });

  describe('editorCallback', () => {
    it('should mark unchecked todo as in-progress', () => {
      const editor = createMockEditor(['- [ ] Task']);

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.setLine).toHaveBeenCalledWith(0, '- [>] Task');
    });

    it('should mark in-progress todo as unchecked', () => {
      const editor = createMockEditor(['- [>] Task']);

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.setLine).toHaveBeenCalledWith(0, '- [ ] Task');
    });

    it('should mark completed todo as in-progress', () => {
      const editor = createMockEditor(['- [x] Task']);

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.setLine).toHaveBeenCalledWith(0, '- [>] Task');
    });

    it('should not modify non-todo lines', () => {
      const editor = createMockEditor(['- Plain list item']);

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.setLine).not.toHaveBeenCalled();
    });

    it('should not modify regular text', () => {
      const editor = createMockEditor(['Regular text']);

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.setLine).not.toHaveBeenCalled();
    });

    it('should work on the line at cursor position', () => {
      const editor = createMockEditor([
        '- [ ] First task',
        '- [ ] Second task',
        '- [ ] Third task',
      ]);
      (editor.getCursor as jest.Mock).mockReturnValue({ line: 2, ch: 0 });

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.getLine).toHaveBeenCalledWith(2);
      expect(editor.setLine).toHaveBeenCalledWith(2, '- [>] Third task');
    });

    it('should mark canceled todo as in-progress', () => {
      const editor = createMockEditor(['- [-] Canceled task']);

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.setLine).toHaveBeenCalledWith(0, '- [>] Canceled task');
    });

    it('should preserve attributes when toggling', () => {
      const editor = createMockEditor(['- [ ] Task @priority(high)']);

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.setLine).toHaveBeenCalledWith(0, '- [>] Task @priority(high)');
    });
  });
});
