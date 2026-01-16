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
  });

  describe('attributesToString', () => {
    const parser = new LineParser();

    it('should convert attributes to string', () => {
      const result = parser.attributesToString({
        textWithoutAttributes: 'Buy groceries',
        attributes: { due: '2025-01-15' },
      });
      expect(result).toBe('Buy groceries [due:: 2025-01-15]');
    });

    it('should handle boolean attributes', () => {
      const result = parser.attributesToString({
        textWithoutAttributes: 'Task',
        attributes: { selected: true },
      });
      expect(result).toBe('Task [selected:: true]');
    });

    it('should handle multiple attributes', () => {
      const result = parser.attributesToString({
        textWithoutAttributes: 'Task',
        attributes: { due: '2025-01-15', priority: 'high' },
      });
      expect(result).toContain('[due:: 2025-01-15]');
      expect(result).toContain('[priority:: high]');
    });

    it('should handle no attributes', () => {
      const result = parser.attributesToString({
        textWithoutAttributes: 'Plain task',
        attributes: {},
      });
      expect(result).toBe('Plain task');
    });
  });
});
