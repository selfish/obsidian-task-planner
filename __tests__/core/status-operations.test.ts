import { StatusOperations } from '../../src/core/operations/status-operations';
import { TaskPlannerSettings } from '../../src/settings/types';
import { TodoStatus } from '../../src/types/todo';

describe('StatusOperations', () => {
  describe('with default settings', () => {
    const operations = new StatusOperations();

    describe('toggleTodo', () => {
      it('should add checkbox to plain list item', () => {
        const result = operations.toggleTodo('- Plain item');
        expect(result).toBe('- [ ] Plain item');
      });

      it('should remove checkbox from todo item', () => {
        const result = operations.toggleTodo('- [ ] Todo item');
        expect(result).toBe('- Todo item');
      });

      it('should remove completed checkbox', () => {
        const result = operations.toggleTodo('- [x] Completed item');
        expect(result).toBe('- Completed item');
      });

      it('should handle indented items', () => {
        const result = operations.toggleTodo('  - Plain item');
        expect(result).toBe('  - [ ] Plain item');
      });

      it('should handle numbered list items', () => {
        const result = operations.toggleTodo('1. Plain item');
        expect(result).toBe('1. [ ] Plain item');
      });
    });

    describe('setCheckmark', () => {
      it('should set checkmark to x for completed', () => {
        const result = operations.setCheckmark('- [ ] Task', 'x');
        expect(result).toBe('- [x] Task');
      });

      it('should set checkmark to space for todo', () => {
        const result = operations.setCheckmark('- [x] Task', ' ');
        expect(result).toBe('- [ ] Task');
      });

      it('should set checkmark to > for in progress', () => {
        const result = operations.setCheckmark('- [ ] Task', '>');
        expect(result).toBe('- [>] Task');
      });

      it('should set checkmark to - for canceled', () => {
        const result = operations.setCheckmark('- [ ] Task', '-');
        expect(result).toBe('- [-] Task');
      });

      it('should set checkmark to ! for attention required', () => {
        const result = operations.setCheckmark('- [ ] Task', '!');
        expect(result).toBe('- [!] Task');
      });

      it('should set checkmark to d for delegated', () => {
        const result = operations.setCheckmark('- [ ] Task', 'd');
        expect(result).toBe('- [d] Task');
      });
    });

    describe('toTodo', () => {
      it('should parse a basic todo item', () => {
        const result = operations.toTodo('- [ ] Buy groceries', 5);
        expect(result.isTodo).toBe(true);
        expect(result.lineNumber).toBe(5);
        expect(result.todo?.text).toBe('Buy groceries');
        expect(result.todo?.status).toBe(TodoStatus.Todo);
      });

      it('should parse a completed todo item', () => {
        const result = operations.toTodo('- [x] Completed task', 10);
        expect(result.isTodo).toBe(true);
        expect(result.todo?.status).toBe(TodoStatus.Complete);
      });

      it('should parse an in-progress todo item', () => {
        const result = operations.toTodo('- [>] In progress task', 1);
        expect(result.isTodo).toBe(true);
        expect(result.todo?.status).toBe(TodoStatus.InProgress);
      });

      it('should parse a canceled todo item', () => {
        const result = operations.toTodo('- [-] Canceled task', 1);
        expect(result.isTodo).toBe(true);
        expect(result.todo?.status).toBe(TodoStatus.Canceled);
      });

      it('should parse canceled with c mark', () => {
        const result = operations.toTodo('- [c] Canceled task', 1);
        expect(result.isTodo).toBe(true);
        expect(result.todo?.status).toBe(TodoStatus.Canceled);
      });

      it('should parse canceled with ] mark', () => {
        const result = operations.toTodo('- []] Canceled task', 1);
        expect(result.isTodo).toBe(true);
        expect(result.todo?.status).toBe(TodoStatus.Canceled);
      });

      it('should parse attention required todo', () => {
        const result = operations.toTodo('- [!] Urgent task', 1);
        expect(result.isTodo).toBe(true);
        expect(result.todo?.status).toBe(TodoStatus.AttentionRequired);
      });

      it('should parse delegated todo', () => {
        const result = operations.toTodo('- [d] Delegated task', 1);
        expect(result.isTodo).toBe(true);
        expect(result.todo?.status).toBe(TodoStatus.Delegated);
      });

      it('should return isTodo=false for non-todo lines', () => {
        const result = operations.toTodo('Regular text', 1);
        expect(result.isTodo).toBe(false);
        expect(result.todo).toBeUndefined();
      });

      it('should return isTodo=false for plain list items', () => {
        const result = operations.toTodo('- Plain item', 1);
        expect(result.isTodo).toBe(false);
      });

      it('should parse todo with attributes', () => {
        const result = operations.toTodo('- [ ] Task [due:: 2025-01-15] [priority:: high]', 1);
        expect(result.isTodo).toBe(true);
        expect(result.todo?.text).toBe('Task');
        expect(result.todo?.attributes).toEqual({
          due: '2025-01-15',
          priority: 'high',
        });
      });

      it('should calculate correct indentation level for spaces', () => {
        const result = operations.toTodo('    - [ ] Indented task', 1);
        expect(result.indentLevel).toBe(4);
      });

      it('should calculate correct indentation level for tabs', () => {
        const result = operations.toTodo('\t- [ ] Tab indented task', 1);
        expect(result.indentLevel).toBe(4);
      });

      it('should set line number on todo', () => {
        const result = operations.toTodo('- [ ] Task', 42);
        expect(result.todo?.line).toBe(42);
      });
    });

    describe('convertAttributes', () => {
      it('should convert natural language date to ISO format', () => {
        const result = operations.convertAttributes('- [ ] Task @tomorrow');
        expect(result).toMatch(/- \[ \] Task \[due:: \d{4}-\d{2}-\d{2}\]/);
      });

      it('should convert priority shortcuts', () => {
        const result = operations.convertAttributes('- [ ] Task @high');
        expect(result).toBe('- [ ] Task [priority:: high]');
      });

      it('should convert @critical to [priority:: critical]', () => {
        const result = operations.convertAttributes('- [ ] Task @critical');
        expect(result).toBe('- [ ] Task [priority:: critical]');
      });

      it('should convert @medium to [priority:: medium]', () => {
        const result = operations.convertAttributes('- [ ] Task @medium');
        expect(result).toBe('- [ ] Task [priority:: medium]');
      });

      it('should convert @low to [priority:: low]', () => {
        const result = operations.convertAttributes('- [ ] Task @low');
        expect(result).toBe('- [ ] Task [priority:: low]');
      });

      it('should convert @lowest to [priority:: lowest]', () => {
        const result = operations.convertAttributes('- [ ] Task @lowest');
        expect(result).toBe('- [ ] Task [priority:: lowest]');
      });

      it('should convert priority case-insensitively (@Critical)', () => {
        const result = operations.convertAttributes('- [ ] Task @Critical');
        expect(result).toBe('- [ ] Task [priority:: critical]');
      });

      it('should convert priority case-insensitively (@HIGH)', () => {
        const result = operations.convertAttributes('- [ ] Task @HIGH');
        expect(result).toBe('- [ ] Task [priority:: high]');
      });

      it('should preserve other attributes', () => {
        const result = operations.convertAttributes('- [ ] Task @custom');
        expect(result).toBe('- [ ] Task [custom:: true]');
      });

      it('should handle line without attributes', () => {
        const result = operations.convertAttributes('- [ ] Plain task');
        expect(result).toBe('- [ ] Plain task');
      });

      it('should convert @today to due date', () => {
        const result = operations.convertAttributes('- [ ] Task @today');
        expect(result).toMatch(/- \[ \] Task \[due:: \d{4}-\d{2}-\d{2}\]/);
      });
    });
  });

  describe('with custom settings', () => {
    const customSettings: TaskPlannerSettings = {
      dueDateAttribute: 'scheduled',
    } as TaskPlannerSettings;
    const operations = new StatusOperations(customSettings);

    it('should use custom due date attribute name', () => {
      const result = operations.convertAttributes('- [ ] Task @today');
      expect(result).toMatch(/- \[ \] Task \[scheduled:: \d{4}-\d{2}-\d{2}\]/);
    });
  });

});
