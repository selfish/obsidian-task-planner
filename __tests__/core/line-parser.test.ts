import { StatusOperations } from '../../src/core/operations/status-operations';
import { LineParser } from '../../src/core/parsers/line-parser';
import { DEFAULT_SETTINGS, TaskPlannerSettings } from '../../src/settings/types';

describe('LineParser', () => {
  describe('parseLine', () => {
    const parser = new LineParser();

    it('should parse a simple task line', () => {
      const result = parser.parseLine('- [ ] Buy groceries');
      expect(result).toEqual({
        indentation: '',
        listMarker: '-',
        checkbox: '[ ]',
        date: '',
        line: 'Buy groceries',
      });
    });

    it('should parse a task with indentation', () => {
      const result = parser.parseLine('  - [ ] Nested task');
      expect(result).toEqual({
        indentation: '  ',
        listMarker: '-',
        checkbox: '[ ]',
        date: '',
        line: 'Nested task',
      });
    });

    it('should parse a task with a date prefix', () => {
      const result = parser.parseLine('- [ ] 2025-01-15: Meeting with team');
      expect(result).toEqual({
        indentation: '',
        listMarker: '-',
        checkbox: '[ ]',
        date: '2025-01-15',
        line: 'Meeting with team',
      });
    });

    it('should parse a completed task', () => {
      const result = parser.parseLine('- [x] Completed task');
      expect(result).toEqual({
        indentation: '',
        listMarker: '-',
        checkbox: '[x]',
        date: '',
        line: 'Completed task',
      });
    });

    it('should parse a numbered list item', () => {
      const result = parser.parseLine('1. [ ] First item');
      expect(result).toEqual({
        indentation: '',
        listMarker: '1.',
        checkbox: '[ ]',
        date: '',
        line: 'First item',
      });
    });

    it('should handle plain text without list markers', () => {
      const result = parser.parseLine('Just some text');
      expect(result).toEqual({
        indentation: '',
        listMarker: '',
        checkbox: '',
        date: '',
        line: 'Just some text',
      });
    });

    // Line 12: test branch where regex doesn't match (empty line)
    it('should handle empty line', () => {
      const result = parser.parseLine('');
      expect(result).toEqual({
        indentation: '',
        listMarker: '',
        checkbox: '',
        date: '',
        line: '',
      });
    });

    it('should handle short date format', () => {
      const result = parser.parseLine('- [ ] 01-15: Short date task');
      expect(result).toEqual({
        indentation: '',
        listMarker: '-',
        checkbox: '[ ]',
        date: '01-15',
        line: 'Short date task',
      });
    });
  });

  describe('lineToString', () => {
    const parser = new LineParser();

    it('should reconstruct a simple task line', () => {
      const result = parser.lineToString({
        indentation: '',
        listMarker: '-',
        checkbox: '[ ]',
        date: '',
        line: 'Buy groceries',
      });
      expect(result).toBe('- [ ] Buy groceries');
    });

    it('should reconstruct a line with indentation', () => {
      const result = parser.lineToString({
        indentation: '  ',
        listMarker: '-',
        checkbox: '[ ]',
        date: '',
        line: 'Nested task',
      });
      expect(result).toBe('  - [ ] Nested task');
    });

    it('should reconstruct a line with date', () => {
      const result = parser.lineToString({
        indentation: '',
        listMarker: '-',
        checkbox: '[ ]',
        date: '2025-01-15',
        line: 'Meeting',
      });
      expect(result).toBe('- [ ] 2025-01-15: Meeting');
    });
  });

  describe('parseAttributes', () => {
    const parser = new LineParser();

    it('should parse [due:: value] attribute', () => {
      const result = parser.parseAttributes('Buy groceries [due:: 2025-01-15]');
      expect(result.textWithoutAttributes).toBe('Buy groceries');
      expect(result.attributes).toEqual({ due: '2025-01-15' });
    });

    it('should parse [priority:: value] attribute', () => {
      const result = parser.parseAttributes('Task [priority:: high]');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ priority: 'high' });
    });

    it('should parse multiple attributes', () => {
      const result = parser.parseAttributes('Task [due:: 2025-01-15] [priority:: high]');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({
        due: '2025-01-15',
        priority: 'high',
      });
    });

    it('should handle text without attributes', () => {
      const result = parser.parseAttributes('Plain task text');
      expect(result.textWithoutAttributes).toBe('Plain task text');
      expect(result.attributes).toEqual({});
    });

    it('should parse @key shortcut as boolean attribute', () => {
      const result = parser.parseAttributes('Task @today');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ today: true });
    });

    it('should convert @high priority shortcut', () => {
      const result = parser.parseAttributes('Task @high');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ priority: 'high' });
    });

    it('should convert @critical priority shortcut', () => {
      const result = parser.parseAttributes('Task @critical');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ priority: 'critical' });
    });

    it('should convert @medium priority shortcut', () => {
      const result = parser.parseAttributes('Task @medium');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ priority: 'medium' });
    });

    it('should convert @low priority shortcut', () => {
      const result = parser.parseAttributes('Task @low');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ priority: 'low' });
    });

    it('should convert @lowest priority shortcut', () => {
      const result = parser.parseAttributes('Task @lowest');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ priority: 'lowest' });
    });

    it('should handle mixed Dataview and shortcut syntax', () => {
      const result = parser.parseAttributes('Task [due:: 2025-01-20] @high');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({
        due: '2025-01-20',
        priority: 'high',
      });
    });

    it('should not match @key inside parentheses', () => {
      const result = parser.parseAttributes('Task with @mention(test)');
      expect(result.textWithoutAttributes).toBe('Task with @mention(test)');
      expect(result.attributes).toEqual({});
    });

    it('should parse @key at end of text', () => {
      const result = parser.parseAttributes('Important task @urgent');
      expect(result.textWithoutAttributes).toBe('Important task');
      expect(result.attributes).toEqual({ urgent: true });
    });

    it('should parse single hashtag', () => {
      const result = parser.parseAttributes('Buy milk #shopping');
      expect(result.textWithoutAttributes).toBe('Buy milk #shopping');
      expect(result.tags).toEqual(['shopping']);
    });

    it('should parse multiple hashtags', () => {
      const result = parser.parseAttributes('Task #work #urgent');
      expect(result.tags).toEqual(['work', 'urgent']);
    });

    it('should NOT match pure number hashtags', () => {
      const result = parser.parseAttributes('Issue #123');
      expect(result.tags).toEqual([]);
    });

    it('should handle hyphens and underscores in hashtags', () => {
      const result = parser.parseAttributes('Task #my-project #work_item');
      expect(result.tags).toEqual(['my-project', 'work_item']);
    });

    it('should deduplicate hashtags', () => {
      const result = parser.parseAttributes('Task #shopping more #shopping');
      expect(result.tags).toEqual(['shopping']);
    });

    it('should work with Dataview attributes', () => {
      const result = parser.parseAttributes('Task #urgent [due:: 2025-01-15]');
      expect(result.textWithoutAttributes).toBe('Task #urgent');
      expect(result.attributes).toEqual({ due: '2025-01-15' });
      expect(result.tags).toEqual(['urgent']);
    });

    it('should return empty array for no hashtags', () => {
      const result = parser.parseAttributes('Plain task');
      expect(result.tags).toEqual([]);
    });

    it('should parse hashtags with numbers after first letter', () => {
      const result = parser.parseAttributes('Task #project2024');
      expect(result.tags).toEqual(['project2024']);
    });
  });

  describe('attributesToString', () => {
    const parser = new LineParser();

    it('should convert attributes to string', () => {
      const result = parser.attributesToString({
        textWithoutAttributes: 'Buy groceries',
        attributes: { due: '2025-01-15' },
        tags: [],
      });
      expect(result).toBe('Buy groceries [due:: 2025-01-15]');
    });

    it('should handle boolean attributes', () => {
      const result = parser.attributesToString({
        textWithoutAttributes: 'Task',
        attributes: { selected: true },
        tags: [],
      });
      expect(result).toBe('Task [selected:: true]');
    });

    it('should handle multiple attributes', () => {
      const result = parser.attributesToString({
        textWithoutAttributes: 'Task',
        attributes: { due: '2025-01-15', priority: 'high' },
        tags: [],
      });
      expect(result).toContain('[due:: 2025-01-15]');
      expect(result).toContain('[priority:: high]');
    });

    it('should handle no attributes', () => {
      const result = parser.attributesToString({
        textWithoutAttributes: 'Plain task',
        attributes: {},
        tags: [],
      });
      expect(result).toBe('Plain task');
    });
  });

  describe('parseAttributes with whitelist settings', () => {
    it('should NOT parse @ inside wiki links [[@person]]', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const result = parser.parseAttributes('Task with [[@jon doe]] link');
      expect(result.textWithoutAttributes).toBe('Task with [[@jon doe]] link');
      expect(result.attributes).toEqual({});
    });

    it('should ignore unknown @ shortcuts like @randomword', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const result = parser.parseAttributes('Task @randomword here');
      expect(result.textWithoutAttributes).toBe('Task @randomword here');
      expect(result.attributes).toEqual({});
    });

    it('should still parse @today as date shortcut', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const result = parser.parseAttributes('Task @today');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ today: true });
    });

    it('should still parse @tomorrow as date shortcut', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const result = parser.parseAttributes('Task @tomorrow');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ tomorrow: true });
    });

    it('should still parse priority shortcuts with settings', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const result = parser.parseAttributes('Task @high');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ priority: 'high' });
    });

    it('should parse @selected builtin shortcut', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const result = parser.parseAttributes('Task @selected');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ selected: true });
    });

    it('should disable all @ shortcuts when master toggle is off', () => {
      const settings: TaskPlannerSettings = {
        ...DEFAULT_SETTINGS,
        atShortcutSettings: {
          ...DEFAULT_SETTINGS.atShortcutSettings,
          enableAtShortcuts: false,
        },
      };
      const parser = new LineParser(settings);
      const result = parser.parseAttributes('Task @today @high');
      expect(result.textWithoutAttributes).toBe('Task @today @high');
      expect(result.attributes).toEqual({});
    });

    it('should disable date shortcuts when toggle is off', () => {
      const settings: TaskPlannerSettings = {
        ...DEFAULT_SETTINGS,
        atShortcutSettings: {
          ...DEFAULT_SETTINGS.atShortcutSettings,
          enableDateShortcuts: false,
        },
      };
      const parser = new LineParser(settings);
      const result = parser.parseAttributes('Task @today @high');
      expect(result.textWithoutAttributes).toBe('Task @today');
      expect(result.attributes).toEqual({ priority: 'high' });
    });

    it('should disable priority shortcuts when toggle is off', () => {
      const settings: TaskPlannerSettings = {
        ...DEFAULT_SETTINGS,
        atShortcutSettings: {
          ...DEFAULT_SETTINGS.atShortcutSettings,
          enablePriorityShortcuts: false,
        },
      };
      const parser = new LineParser(settings);
      const result = parser.parseAttributes('Task @today @high');
      expect(result.textWithoutAttributes).toBe('Task @high');
      expect(result.attributes).toEqual({ today: true });
    });

    it('should disable builtin shortcuts when toggle is off', () => {
      const settings: TaskPlannerSettings = {
        ...DEFAULT_SETTINGS,
        atShortcutSettings: {
          ...DEFAULT_SETTINGS.atShortcutSettings,
          enableBuiltinShortcuts: false,
        },
      };
      const parser = new LineParser(settings);
      const result = parser.parseAttributes('Task @selected');
      expect(result.textWithoutAttributes).toBe('Task @selected');
      expect(result.attributes).toEqual({});
    });

    it('should parse custom shortcuts from settings', () => {
      const settings: TaskPlannerSettings = {
        ...DEFAULT_SETTINGS,
        atShortcutSettings: {
          ...DEFAULT_SETTINGS.atShortcutSettings,
          customShortcuts: [
            { keyword: 'work', targetAttribute: 'context', value: 'work' },
          ],
        },
      };
      const parser = new LineParser(settings);
      const result = parser.parseAttributes('Task @work');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ context: 'work' });
    });

    it('should handle Dataview attributes when @ shortcuts are disabled', () => {
      const settings: TaskPlannerSettings = {
        ...DEFAULT_SETTINGS,
        atShortcutSettings: {
          ...DEFAULT_SETTINGS.atShortcutSettings,
          enableAtShortcuts: false,
        },
      };
      const parser = new LineParser(settings);
      const result = parser.parseAttributes('Task [due:: 2025-01-15]');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ due: '2025-01-15' });
    });

    it('should handle wiki link with @ followed by known shortcut', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const result = parser.parseAttributes('Task [[@high priority]] @low');
      expect(result.textWithoutAttributes).toBe('Task [[@high priority]]');
      expect(result.attributes).toEqual({ priority: 'low' });
    });

    it('should handle multiple wiki links', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const result = parser.parseAttributes('Meeting with [[@alice]] and [[@bob]]');
      expect(result.textWithoutAttributes).toBe('Meeting with [[@alice]] and [[@bob]]');
      expect(result.attributes).toEqual({});
    });

    // Line 83: Edge cases that exercise the final return null in parseSingleAttribute
    // This tests scenarios where attribute patterns might be malformed or unusual
    it('should handle empty attribute key gracefully', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      // Dataview attribute with empty or whitespace-only key
      const result = parser.parseAttributes('Task [ :: value]');
      expect(result.textWithoutAttributes).toBe('Task [ :: value]');
      expect(result.attributes).toEqual({});
    });

    it('should handle malformed dataview-like syntax', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      // Not a valid Dataview attribute (no double colon)
      const result = parser.parseAttributes('Task [key: value]');
      expect(result.textWithoutAttributes).toBe('Task [key: value]');
      expect(result.attributes).toEqual({});
    });

    it('should handle @ followed by non-word characters', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const result = parser.parseAttributes('Email: test@example.com');
      expect(result.textWithoutAttributes).toBe('Email: test@example.com');
      expect(result.attributes).toEqual({});
    });

    it('should not parse @ at end of string without keyword', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const result = parser.parseAttributes('Task ending with @');
      // The @ without a word after it should not be matched
      expect(result.textWithoutAttributes).toBe('Task ending with @');
      expect(result.attributes).toEqual({});
    });

    it('should handle mixed valid and invalid patterns', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const result = parser.parseAttributes('Task [valid:: attr] [invalid: syntax] @high');
      // Valid Dataview and @high should be parsed, invalid syntax ignored
      expect(result.attributes).toEqual({ valid: 'attr', priority: 'high' });
    });
  });

  describe('lossless targeted mutations', () => {
    it('preserves nonstandard task separators when rebuilding a line', () => {
      const parser = new LineParser();
      const source = '-   [ ]\t2026-08-01:\tTask';

      expect(parser.lineToString(parser.parseLine(source))).toBe(source);
    });

    it('removes a leading attribute and its following separator', () => {
      const parser = new LineParser();

      expect(parser.updateAttribute('[due:: old]\tTask', 'due', undefined)).toBe('Task');
    });

    it('replaces a priority shortcut without touching code or wikilinks', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);

      expect(parser.updateAttribute('Task `@high` [[Page|@high]] @high', 'priority', 'medium')).toBe(
        'Task `@high` [[Page|@high]] [priority:: medium]'
      );
    });

    it('replaces a matching custom shortcut and leaves other targets alone', () => {
      const settings: TaskPlannerSettings = {
        ...DEFAULT_SETTINGS,
        atShortcutSettings: {
          ...DEFAULT_SETTINGS.atShortcutSettings,
          customShortcuts: [
            { keyword: 'work', targetAttribute: 'context', value: 'work' },
            { keyword: 'soon', targetAttribute: 'due', value: 'tomorrow' },
          ],
        },
      };
      const parser = new LineParser(settings);

      expect(parser.updateAttribute('Task @work @soon', 'context', 'home')).toBe('Task [context:: home] @soon');
      expect(parser.updateAttribute('Task `@work` @work', 'context', 'home')).toBe('Task `@work` [context:: home]');
    });

    it('replaces enabled date shortcuts and leaves disabled ones literal', () => {
      const enabled = new LineParser(DEFAULT_SETTINGS);
      expect(enabled.updateAttribute('Task @today', 'today', '2026-08-01')).toBe('Task [today:: 2026-08-01]');

      const disabled = new LineParser({
        ...DEFAULT_SETTINGS,
        atShortcutSettings: { ...DEFAULT_SETTINGS.atShortcutSettings, enableDateShortcuts: false },
      });
      expect(disabled.updateAttribute('Task @today', 'today', '2026-08-01')).toBe('Task @today [today:: 2026-08-01]');
    });

    it('leaves disabled shortcuts literal', () => {
      const settings: TaskPlannerSettings = {
        ...DEFAULT_SETTINGS,
        atShortcutSettings: {
          ...DEFAULT_SETTINGS.atShortcutSettings,
          enablePriorityShortcuts: false,
          enableBuiltinShortcuts: false,
        },
      };
      const parser = new LineParser(settings);

      expect(parser.updateAttribute('Task @high @selected', 'priority', 'low')).toBe('Task @high @selected [priority:: low]');
      expect(parser.updateAttribute('Task @high @selected', 'selected', undefined)).toBe('Task @high @selected');
    });

    it('preserves generic shortcut mutation without settings', () => {
      const parser = new LineParser();
      expect(parser.updateAttribute('Task @priority', 'priority', 'low')).toBe('Task [priority:: low]');
    });

    it('deduplicates overlapping shortcut matches without deleting trailing text', () => {
      const parser = new LineParser({
        ...DEFAULT_SETTINGS,
        atShortcutSettings: {
          ...DEFAULT_SETTINGS.atShortcutSettings,
          customShortcuts: [{ keyword: 'high', targetAttribute: 'priority', value: 'critical' }],
        },
      });

      expect(parser.updateAttribute('Task @high after', 'priority', 'low')).toBe('Task [priority:: low] after');
      expect(parser.updateAttribute('Task @high middle [priority:: old] after', 'priority', 'low')).toBe('Task middle [priority:: low] after');
      expect(parser.updateAttribute('Task @high middle @medium after', 'priority', 'low')).toBe('Task middle [priority:: low] after');
    });

    it('matches recognized shortcuts before punctuation', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      expect(parser.updateAttribute('Task @high.', 'priority', 'low')).toBe('Task [priority:: low].');
      expect(parser.updateAttribute('Task @selected,', 'selected', undefined)).toBe('Task,');
    });

    it('does not mutate shortcuts inside another metadata value', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const text = 'Task [note:: ping @high] after';
      expect(parser.updateAttribute(text, 'priority', 'low')).toBe(`${text} [priority:: low]`);
      expect(parser.updateAttribute(text, 'priority', undefined)).toBe(text);
    });

    it('preserves spacing boundaries while covering empty and malformed metadata inputs', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      expect(parser.updateAttribute('', 'due', 'new')).toBe('[due:: new]');
      expect(parser.updateAttribute('Task ', 'due', 'new')).toBe('Task [due:: new]');
      expect(parser.updateAttribute('[due:: old]', 'due', undefined)).toBe('');
      expect(parser.appendTag('', 'new')).toBe('#new');
      expect(parser.appendTag('Task ', 'new')).toBe('Task #new');
      expect(parser.appendTag('[due:: old]', 'new')).toBe('#new [due:: old]');
      expect(parser.appendTag('Task  [due:: old]', 'new')).toBe('Task  #new [due:: old]');
      expect(parser.appendTag('Task (note:: open', 'new')).toBe('Task (note:: open #new');
    });

    it('does not treat delimiters in protected text as closing malformed metadata', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      for (const text of ['Task (note:: text `)` trailing', 'Task (note:: text [[Page|)]] trailing']) {
        expect(parser.appendTag(text, 'new')).toBe(`${text} #new`);
      }
    });

    it('appends tags outside arbitrary delimiter wrappers', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      expect(parser.appendTag('Task (wrapper (due:: 2026-07-23))', 'planned')).toBe('Task (wrapper (due:: 2026-07-23)) #planned');
      expect(parser.appendTag('Task (wrapper (due:: inner)) (owner:: Alice)', 'planned')).toBe('Task (wrapper (due:: inner)) #planned (owner:: Alice)');
    });

    it('keeps nested metadata protected from tag mutations inside arbitrary wrappers', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const text = 'Task (wrapper (note:: #keep)) #remove';
      expect(parser.hasTag(text, 'keep')).toBe(false);
      expect(parser.removeTag(text, 'keep')).toBe(text);
    });

    it('preserves escaped hashtags while parsing and removing tags', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const escaped = String.raw`Literal \#work`;
      const mixed = String.raw`Literal \#work #work`;

      expect(parser.parseAttributes(escaped).tags).toEqual([]);
      expect(parser.hasTag(escaped, 'work')).toBe(false);
      expect(parser.removeTag(escaped, 'work')).toBe(escaped);
      expect(parser.parseAttributes(mixed).tags).toEqual(['work']);
      expect(parser.removeTag(mixed, 'work')).toBe(escaped);
      expect(parser.parseAttributes(String.raw`Literal \\#work`).tags).toEqual(['work']);
    });

    it('preserves hashtag-looking URL fragments while parsing and removing tags', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const text = 'Read [docs](https://example.com/#work) or https://example.com/#work #work';

      expect(parser.parseAttributes('Read [docs](#work) or https://example.com/#work').tags).toEqual([]);
      expect(parser.parseAttributes(text).tags).toEqual(['work']);
      expect(parser.removeTag(text, 'work')).toBe('Read [docs](https://example.com/#work) or https://example.com/#work');

      expect(parser.parseAttributes('Read [docs](https://example.com)#work').tags).toEqual(['work']);
      expect(parser.removeTag('Read [docs](https://example.com)#work', 'work')).toBe('Read [docs](https://example.com)');

      for (const destination of [
        ' ',
        'relative\\)#work',
        'relative(nested)#work',
        'relative "title #work"',
        "relative 'title #work'",
        'relative "title \\" #work"',
        'relative (title #work)',
        '<relative\\>#work>',
        '<relative #work>',
        ' #work',
      ]) {
        const linked = `Read [docs](${destination})`;
        expect({ destination, tags: parser.parseAttributes(linked).tags }).toEqual({ destination, tags: [] });
        expect(parser.hasTag(linked, 'work')).toBe(false);
        expect(parser.removeTag(linked, 'work')).toBe(linked);
      }

      const nested = 'Read [outer [inner]](#work) or https://example.com/path_(nested)#work';
      expect(parser.parseAttributes(nested).tags).toEqual([]);
      expect(parser.hasTag(nested, 'work')).toBe(false);
      expect(parser.removeTag(nested, 'work')).toBe(nested);

      const uris = '<urn:example:foo#work> https://[::1]/#work mailto:user@example.com#work #work';
      expect(parser.parseAttributes(uris).tags).toEqual(['work']);
      expect(parser.removeTag(uris, 'work')).toBe('<urn:example:foo#work> https://[::1]/#work mailto:user@example.com#work');

      const quotedTitle = 'Read [docs](relative "title ) #work")';
      expect(parser.parseAttributes(quotedTitle).tags).toEqual([]);
      expect(parser.hasTag(quotedTitle, 'work')).toBe(false);
      expect(parser.removeTag(quotedTitle, 'work')).toBe(quotedTitle);

      const protectedText = 'Task `#work` [[Page#work]] [note:: #work]';
      expect(parser.parseAttributes(protectedText).tags).toEqual([]);
      expect(parser.hasTag(protectedText, 'work')).toBe(false);
      expect(parser.removeTag(protectedText, 'work')).toBe(protectedText);

      for (const linkedImage of ['[![moon](moon.jpg)](#work)', '![foo [bar](/url)](#work)']) {
        expect(parser.parseAttributes(linkedImage).tags).toEqual([]);
        expect(parser.hasTag(linkedImage, 'work')).toBe(false);
        expect(parser.removeTag(linkedImage, 'work')).toBe(linkedImage);
      }

      const protectedClosers = '[[https://example.com/#keep]]#work [note:: https://example.com/#keep]#work';
      expect(parser.parseAttributes(protectedClosers).tags).toEqual(['work']);
      expect(parser.hasTag(protectedClosers, 'work')).toBe(true);
      expect(parser.removeTag(protectedClosers, 'work')).toBe('[[https://example.com/#keep]] [note:: https://example.com/#keep]');

      for (const richLabel of ['[x <xx:a](x)>](#work)', '[x <i a="](x)">](#work)']) {
        expect(parser.parseAttributes(richLabel).tags).toEqual([]);
        expect(parser.hasTag(richLabel, 'work')).toBe(false);
        expect(parser.removeTag(richLabel, 'work')).toBe(richLabel);
      }

      const punctuatedTag = 'Task #work: details';
      expect(parser.parseAttributes(punctuatedTag).tags).toEqual(['work']);
      expect(parser.hasTag(punctuatedTag, 'work')).toBe(true);
      expect(parser.removeTag(punctuatedTag, 'work')).toBe('Task : details');

      for (const [malformed, removed] of [
        ['Read [docs](relative( #work)', 'Read [docs](relative( )'],
        ['Task ](#work)', 'Task ]()'],
        ['Task \\](#work)', 'Task \\]()'],
        ['Task \\[docs](#work)', 'Task \\[docs]()'],
        ['Task [docs](relative #work)', 'Task [docs](relative )'],
        ['Task [docs](foo\\ #work)', 'Task [docs](foo\\ )'],
        ['Task [x](<url>"title #work")', 'Task [x](<url>"title ")'],
        ['Task [outer [inner](dest)](#work)', 'Task [outer [inner](dest)]()'],
        ['Task `https://example.com/#fragment`#work', 'Task `https://example.com/#fragment`'],
      ]) {
        expect(parser.parseAttributes(malformed).tags).toEqual(['work']);
        expect(parser.hasTag(malformed, 'work')).toBe(true);
        expect(parser.removeTag(malformed, 'work')).toBe(removed);
      }

      for (const malformed of [
        'Read [docs](<relative< #work>)',
        'Read [docs](<relative #work',
        'Read [docs](relative<value #work)',
        'Read [docs](relative (nested(title) #work))',
        'Read [docs](relative "title #work)',
        'Read [docs](relative "title"suffix #work)',
      ]) {
        expect(parser.parseAttributes(malformed).tags).toEqual(['work']);
        expect(parser.hasTag(malformed, 'work')).toBe(true);
        expect(parser.removeTag(malformed, 'work')).toBe(malformed.endsWith('#work') ? malformed.replace(' #work', '') : malformed.replace('#work', ''));
      }

      const tooDeep = `Read [docs](${'('.repeat(33)} #work${')'.repeat(34)}`;
      expect(parser.parseAttributes(tooDeep).tags).toEqual(['work']);
      expect(parser.hasTag(tooDeep, 'work')).toBe(true);
      expect(parser.removeTag(tooDeep, 'work')).toBe(tooDeep.replace('#work', ''));
    });

    it('preserves recognized shortcuts inside bare URIs', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const text = 'Read https://example.test/@high/docs';

      expect(parser.parseAttributes(text)).toEqual({ textWithoutAttributes: text, attributes: {}, tags: [] });
      expect(parser.updateAttribute(text, 'priority', 'low')).toBe(`${text} [priority:: low]`);
      expect(parser.updateAttribute(text, 'priority', undefined)).toBe(text);
      expect(new StatusOperations(DEFAULT_SETTINGS).convertAttributes(`- [ ] ${text}`)).toBe(`- [ ] ${text}`);
    });

    it('does not mutate square syntax nested inside unknown metadata', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      const text = 'Task (note:: [priority:: high]) after';
      expect(parser.updateAttribute(text, 'priority', 'low')).toBe(`${text} [priority:: low]`);
      expect(parser.updateAttribute(text, 'priority', undefined)).toBe(text);
    });

    it('updates only the last effective duplicate during ordinary edits', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      expect(parser.updateAttribute('Task (Priority:: low) [priority:: medium]', 'priority', 'critical')).toBe('Task (Priority:: low) [priority:: critical]');
    });

    it('preserves rejected function-like shortcut text while converting a real shortcut', () => {
      const operations = new StatusOperations(DEFAULT_SETTINGS);
      expect(operations.convertAttributes('- [ ] Task @high(Priority2099) @high')).toBe('- [ ] Task @high(Priority2099) [priority:: high]');
    });

    it('does not mutate custom shortcut keywords outside the parser grammar', () => {
      const parser = new LineParser({
        ...DEFAULT_SETTINGS,
        atShortcutSettings: {
          ...DEFAULT_SETTINGS.atShortcutSettings,
          customShortcuts: [{ keyword: 'follow-up', targetAttribute: 'owner', value: 'Alice' }],
        },
      });
      const text = 'Task @follow-up';
      expect(parser.parseAttributes(text).attributes).toEqual({});
      expect(parser.updateAttribute(text, 'owner', 'Bob')).toBe('Task @follow-up [owner:: Bob]');
    });

    it('preserves malformed empty metadata during update and removal', () => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      expect(parser.updateAttribute('Task (Due::)', 'due', '2026-08-01')).toBe('Task (Due::) [due:: 2026-08-01]');
      expect(parser.updateAttribute('Task (Due::)', 'due', undefined)).toBe('Task (Due::)');
    });

    it.each(['Task (due:: marker `)` trailing', 'Task [due:: marker `]` trailing'])('does not use protected closers as metadata boundaries: %s', (text) => {
      const parser = new LineParser(DEFAULT_SETTINGS);
      expect(parser.parseAttributes(text).attributes).toEqual({});
      expect(parser.updateAttribute(text, 'due', '2026-08-01')).toBe(`${text} [due:: 2026-08-01]`);
      expect(parser.updateAttribute(text, 'due', undefined)).toBe(text);
    });

    it.each(['- [ ] Task (high:: marker `)` trailing', '- [ ] Task [high:: marker `]` trailing'])('does not convert aliases closed only by protected text: %s', (text) => {
      expect(new StatusOperations(DEFAULT_SETTINGS).convertAttributes(text)).toBe(text);
    });
  });
});
