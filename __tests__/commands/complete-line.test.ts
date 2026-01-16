import { CompleteLineCommand } from '../../src/commands/complete-line';
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

describe('CompleteLineCommand', () => {
  let statusOperations: StatusOperations;
  let command: CompleteLineCommand;

  beforeEach(() => {
    statusOperations = new StatusOperations();
    command = new CompleteLineCommand(statusOperations);
  });

  describe('properties', () => {
    it('should have correct id', () => {
      expect(command.id).toBe('complete-line');
    });

    it('should have correct name', () => {
      expect(command.name).toBe('Complete line attributes');
    });

    it('should have correct icon', () => {
      expect(command.icon).toBe('check-small');
    });
  });

  describe('editorCallback', () => {
    it('should convert priority shortcut to full attribute', () => {
      const editor = createMockEditor(['- [ ] Task @high']);

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.setLine).toHaveBeenCalledWith(0, '- [ ] Task [priority:: high]');
    });

    it('should convert natural language date to ISO format', () => {
      const editor = createMockEditor(['- [ ] Task @due(tomorrow)']);

      command.editorCallback(editor, {} as MarkdownView);

      const setLineCall = (editor.setLine as jest.Mock).mock.calls[0];
      expect(setLineCall[0]).toBe(0);
      expect(setLineCall[1]).toMatch(/- \[ \] Task \[due:: \d{4}-\d{2}-\d{2}\]/);
    });

    it('should convert @today to due date', () => {
      const editor = createMockEditor(['- [ ] Task @today']);

      command.editorCallback(editor, {} as MarkdownView);

      const setLineCall = (editor.setLine as jest.Mock).mock.calls[0];
      expect(setLineCall[1]).toMatch(/- \[ \] Task \[due:: \d{4}-\d{2}-\d{2}\]/);
    });

    it('should preserve lines without attributes', () => {
      const editor = createMockEditor(['- [ ] Plain task']);

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.setLine).toHaveBeenCalledWith(0, '- [ ] Plain task');
    });

    it('should work on the line at cursor position', () => {
      const editor = createMockEditor([
        '- [ ] First task',
        '- [ ] Second task @high',
        '- [ ] Third task',
      ]);
      (editor.getCursor as jest.Mock).mockReturnValue({ line: 1, ch: 0 });

      command.editorCallback(editor, {} as MarkdownView);

      expect(editor.getLine).toHaveBeenCalledWith(1);
      expect(editor.setLine).toHaveBeenCalledWith(1, '- [ ] Second task [priority:: high]');
    });
  });
});
