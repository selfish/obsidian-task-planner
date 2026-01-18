import { LineParser } from '../../src/core/parsers/line-parser';

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

    it('should parse @key(value) syntax', () => {
      const result = parser.parseAttributes('Task @due(2025-01-20)');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({ due: '2025-01-20' });
    });

    it('should parse multiple @key(value) attributes', () => {
      const result = parser.parseAttributes('Task @due(2025-01-20) @priority(high)');
      expect(result.textWithoutAttributes).toBe('Task');
      expect(result.attributes).toEqual({
        due: '2025-01-20',
        priority: 'high',
      });
    });

    it('should not extract @mentions inside wiki links', () => {
      const result = parser.parseAttributes('Speak to [[@jon do]] about x');
      expect(result.textWithoutAttributes).toBe('Speak to [[@jon do]] about x');
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
});
