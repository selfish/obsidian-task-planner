import { ToggleTodoCommand } from '../../src/commands/toggle-todo';
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

describe('ToggleTodoCommand', () => {
  let statusOperations: StatusOperations;
  let command: ToggleTodoCommand;

  beforeEach(() => {
    statusOperations = new StatusOperations();
    command = new ToggleTodoCommand(statusOperations);
  });

  describe('properties', () => {
    it('should have correct id', () => {
      expect(command.id).toBe('toggle-todo');
    });

    it('should have correct name', () => {
      expect(command.name).toBe('Mark todo as checked / unchecked');
    });

    it('should have correct icon', () => {
      expect(command.icon).toBe('check-small');
    });
  });

  describe('editorCallback', () => {
    it('should mark unchecked todo as completed', () => {
      const editor = createMockEditor(['- [ ] Task']);

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.setLine).toHaveBeenCalledWith(0, '- [x] Task');
    });

    it('should mark completed todo as unchecked', () => {
      const editor = createMockEditor(['- [x] Task']);

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.setLine).toHaveBeenCalledWith(0, '- [ ] Task');
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
      (editor.getCursor as jest.Mock).mockReturnValue({ line: 1, ch: 0 });

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.getLine).toHaveBeenCalledWith(1);
      expect(editor.setLine).toHaveBeenCalledWith(1, '- [x] Second task');
    });

    it('should mark in-progress todo as completed', () => {
      const editor = createMockEditor(['- [>] In progress task']);

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.setLine).toHaveBeenCalledWith(0, '- [x] In progress task');
    });

    it('should preserve attributes when toggling', () => {
      const editor = createMockEditor(['- [ ] Task [due:: 2025-01-15]']);

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.setLine).toHaveBeenCalledWith(0, '- [x] Task [due:: 2025-01-15]');
    });
  });
});
