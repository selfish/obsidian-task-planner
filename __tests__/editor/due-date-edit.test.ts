import { currentDueDate, dateTriggerStart, editDueDate, isTaskLine, isValidDueDate } from '../../src/editor/due-date-edit';
import { DEFAULT_SETTINGS } from '../../src/settings';

const settings = () => JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

describe('in-note due date editing', () => {
  it('recognizes task lines but not fenced examples or plain text', () => {
    expect(isTaskLine('- [ ] Task', 0)).toBe(true);
    expect(isTaskLine('  1. [x] Task', 0)).toBe(true);
    expect(isTaskLine('Plain text', 0)).toBe(false);
    expect(isTaskLine('```md\n- [ ] Task\n```', 1)).toBe(false);
    expect(isTaskLine('~~~md\n- [ ] Task\n~~~', 1)).toBe(false);
  });

  it('recognizes an exact @date trigger', () => {
    const line = '- [ ] Task @date';
    expect(dateTriggerStart(line, line.length, settings())).toBe(11);
    expect(dateTriggerStart(line.toUpperCase(), line.length, settings())).toBe(11);
  });

  it.each(['`@date`', '[[note @date]]', '[link @date](https://example.com)', '[note:: @date]', '(note:: @date)', 'https://example.com/@date', 'someone@date', '\\@date', '@datetime'])('does not hijack protected text: %s', (text) => {
    const line = '- [ ] Task ' + text;
    expect(dateTriggerStart(line, line.indexOf('@date') + 5, settings())).toBeNull();
  });

  it('respects disabled date shortcuts and an existing custom @date', () => {
    const config = settings();
    config.atShortcutSettings.enableDateShortcuts = false;
    expect(dateTriggerStart('- [ ] @date', 11, config)).toBeNull();
    config.atShortcutSettings.enableDateShortcuts = true;
    config.atShortcutSettings.enableAtShortcuts = false;
    expect(dateTriggerStart('- [ ] @date', 11, config)).toBeNull();
    config.atShortcutSettings.enableAtShortcuts = true;
    config.atShortcutSettings.customShortcuts.push({ keyword: 'date', targetAttribute: 'owner', value: 'me' });
    expect(dateTriggerStart('- [ ] @date', 11, config)).toBeNull();
  });

  it('inserts an exact date at the shortcut without consuming other shortcuts', () => {
    expect(editDueDate('- [ ] Task @date @high', '2026-10-20', settings(), 11)).toBe('- [ ] Task [due:: 2026-10-20] @high');
  });

  it('updates an existing parenthesized date and preserves unrelated bytes', () => {
    const line = '\t-   [ ]  Task [[Link]] (due:: 2026-08-01) [owner:: me] #tag  ';
    expect(editDueDate(line, '2026-10-20', settings())).toBe(line.replace('2026-08-01', '2026-10-20'));
  });

  it('uses the configured due attribute and removes conflicting relative shortcuts', () => {
    const config = settings();
    config.dueDateAttribute = 'deadline';
    expect(editDueDate('- [ ] Task @tomorrow @high [deadline:: 2026-08-01]', '2026-10-20', config)).toBe('- [ ] Task @high [deadline:: 2026-10-20]');
  });

  it('leaves disabled and unrelated shortcuts literal', () => {
    const config = settings();
    config.atShortcutSettings.enableDateShortcuts = false;
    expect(editDueDate('- [ ] Task @tomorrow @high', '2026-10-20', config)).toBe('- [ ] Task @tomorrow @high [due:: 2026-10-20]');
  });

  it('does not rewrite date-looking code or link labels', () => {
    expect(editDueDate('- [ ] `[due:: 2026-01-01]` [[note|due:: today]]', '2026-10-20', settings())).toBe('- [ ] `[due:: 2026-01-01]` [[note|due:: today]] [due:: 2026-10-20]');
  });

  it('resolves duplicate dates to one chosen value', () => {
    const result = editDueDate('- [ ] Task [due:: 2026-01-01] @date (due:: 2026-02-02)', '2026-10-20', settings(), 30);
    expect(result.match(/due::/g)).toHaveLength(1);
    expect(result).toContain('2026-10-20');
    expect(result).not.toContain('@date');
  });

  it('removes only scheduling metadata', () => {
    expect(editDueDate('- [ ] Task [due:: 2026-10-20] @tomorrow @high [owner:: me]', null, settings())).toBe('- [ ] Task @high [owner:: me]');
  });

  it('uses source order when seeding the picker', () => {
    expect(currentDueDate('- [ ] Task @tomorrow [due:: 2026-10-20]', settings())).toBe('2026-10-20');
    expect(currentDueDate('- [ ] Task [due:: 2026-10-20] (due:: 2026-11-21)', settings())).toBe('2026-11-21');
  });

  it.each(['2026-02-29', '2026-13-01', '0000-01-01', '2026-1-1', '', 'invalid'])('rejects invalid date %s', (date) => {
    expect(isValidDueDate(date)).toBe(false);
    expect(() => editDueDate('- [ ] Task', date, settings())).toThrow('Invalid due date');
  });

  it('accepts a valid leap day', () => expect(isValidDueDate('2028-02-29')).toBe(true));
  it('fails closed for a changed trigger', () => expect(() => editDueDate('- [ ] Task @today', '2026-10-20', settings(), 11)).toThrow('Date shortcut changed'));
});
