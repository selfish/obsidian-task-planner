import { App, Editor, TFile } from 'obsidian';
import { DueDateSuggest } from '../../src/editor/due-date-suggest';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { DueDateEditor } from '../../src/ui/due-date-modal';

describe('native due date suggestion', () => {
  function setup(text = '- [ ] Task @date') {
    const config = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const open = jest.fn();
    const suggest = new DueDateSuggest(new App(), () => config, { open } as unknown as DueDateEditor);
    const editor = { getValue: () => text, getLine: () => text, somethingSelected: () => false } as unknown as Editor;
    return { config, suggest, editor, open };
  }

  it('offers one calendar action with exact source positions', () => {
    const { suggest, editor } = setup();
    const file = new TFile();
    const trigger = suggest.onTrigger({ line: 0, ch: 16 }, editor, file);
    expect(trigger).toEqual({ start: { line: 0, ch: 11 }, end: { line: 0, ch: 16 }, query: 'date' });
    expect(suggest.getSuggestions()).toEqual(['Choose due date…']);
    const el = document.createElement('div');
    suggest.renderSuggestion('Choose due date…', el);
    expect(el.textContent).toBe('Choose due date…');
  });

  it('opens the shared picker only for a selected live context', () => {
    const { suggest, editor, open } = setup();
    suggest.selectSuggestion();
    expect(open).not.toHaveBeenCalled();
    const file = new TFile();
    suggest.context = { editor, file, start: { line: 0, ch: 11 }, end: { line: 0, ch: 16 }, query: 'date' };
    suggest.selectSuggestion();
    expect(suggest.close).toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(editor, file, 11);
  });

  it('does not hijack disabled shortcuts, ordinary text, or editors without a file', () => {
    const { config, suggest, editor } = setup();
    expect(suggest.onTrigger({ line: 0, ch: 16 }, editor, null)).toBeNull();
    config.atShortcutSettings.enableAtShortcuts = false;
    expect(suggest.onTrigger({ line: 0, ch: 16 }, editor, new TFile())).toBeNull();
    const plain = setup('ordinary @date');
    expect(plain.suggest.onTrigger({ line: 0, ch: 14 }, plain.editor, new TFile())).toBeNull();
  });
});
