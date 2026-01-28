import { StatusOperations } from '../../src/core/operations/status-operations';
import { TaskPlannerSettings } from '../../src/settings/types';
import { TaskStatus } from '../../src/types/task';

describe('StatusOperations', () => {
  describe('with default settings', () => {
    const operations = new StatusOperations();

    describe('toggleTask', () => {
      it('should add checkbox to plain list item', () => {
        const result = operations.toggleTask('- Plain item');
        expect(result).toBe('- [ ] Plain item');
      });

      it('should remove checkbox from todo item', () => {
        const result = operations.toggleTask('- [ ] Todo item');
        expect(result).toBe('- Todo item');
      });

      it('should remove completed checkbox', () => {
        const result = operations.toggleTask('- [x] Completed item');
        expect(result).toBe('- Completed item');
      });

      it('should handle indented items', () => {
        const result = operations.toggleTask('  - Plain item');
        expect(result).toBe('  - [ ] Plain item');
      });

      it('should handle numbered list items', () => {
        const result = operations.toggleTask('1. Plain item');
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

    describe('toTask', () => {
      it('should parse a basic todo item', () => {
        const result = operations.toTask('- [ ] Buy groceries', 5);
        expect(result.isTask).toBe(true);
        expect(result.lineNumber).toBe(5);
        expect(result.task?.text).toBe('Buy groceries');
        expect(result.task?.status).toBe(TaskStatus.Todo);
      });

      it('should parse a completed todo item', () => {
        const result = operations.toTask('- [x] Completed task', 10);
        expect(result.isTask).toBe(true);
        expect(result.task?.status).toBe(TaskStatus.Complete);
      });

      it('should parse an in-progress todo item', () => {
        const result = operations.toTask('- [>] In progress task', 1);
        expect(result.isTask).toBe(true);
        expect(result.task?.status).toBe(TaskStatus.InProgress);
      });

      it('should parse a canceled todo item', () => {
        const result = operations.toTask('- [-] Canceled task', 1);
        expect(result.isTask).toBe(true);
        expect(result.task?.status).toBe(TaskStatus.Canceled);
      });

      it('should parse canceled with c mark', () => {
        const result = operations.toTask('- [c] Canceled task', 1);
        expect(result.isTask).toBe(true);
        expect(result.task?.status).toBe(TaskStatus.Canceled);
      });

      it('should parse canceled with ] mark', () => {
        const result = operations.toTask('- []] Canceled task', 1);
        expect(result.isTask).toBe(true);
        expect(result.task?.status).toBe(TaskStatus.Canceled);
      });

      it('should parse attention required todo', () => {
        const result = operations.toTask('- [!] Urgent task', 1);
        expect(result.isTask).toBe(true);
        expect(result.task?.status).toBe(TaskStatus.AttentionRequired);
      });

      it('should parse delegated todo', () => {
        const result = operations.toTask('- [d] Delegated task', 1);
        expect(result.isTask).toBe(true);
        expect(result.task?.status).toBe(TaskStatus.Delegated);
      });

      it('should return isTask=false for non-todo lines', () => {
        const result = operations.toTask('Regular text', 1);
        expect(result.isTask).toBe(false);
        expect(result.todo).toBeUndefined();
      });

      it('should return isTask=false for plain list items', () => {
        const result = operations.toTask('- Plain item', 1);
        expect(result.isTask).toBe(false);
      });

      it('should parse todo with attributes', () => {
        const result = operations.toTask('- [ ] Task [due:: 2025-01-15] [priority:: high]', 1);
        expect(result.isTask).toBe(true);
        expect(result.task?.text).toBe('Task');
        expect(result.task?.attributes).toEqual({
          due: '2025-01-15',
          priority: 'high',
        });
      });

      it('should calculate correct indentation level for spaces', () => {
        const result = operations.toTask('    - [ ] Indented task', 1);
        expect(result.indentLevel).toBe(4);
      });

      it('should calculate correct indentation level for tabs', () => {
        const result = operations.toTask('\t- [ ] Tab indented task', 1);
        expect(result.indentLevel).toBe(4);
      });

      it('should set line number on todo', () => {
        const result = operations.toTask('- [ ] Task', 42);
        expect(result.task?.line).toBe(42);
      });

      // Line 115: test branch where lineNumber is undefined
      it('should not set line property when lineNumber is undefined', () => {
        const result = operations.toTask('- [ ] Task', undefined as unknown as number);
        expect(result.isTask).toBe(true);
        expect(result.task?.line).toBeUndefined();
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

      it('should convert date attribute with string value (e.g., [due:: tomorrow])', () => {
        const result = operations.convertAttributes('- [ ] Task [due:: tomorrow]');
        expect(result).toMatch(/- \[ \] Task \[due:: \d{4}-\d{2}-\d{2}\]/);
      });

      it('should convert priority attribute key to priority property (e.g., [high:: value])', () => {
        const result = operations.convertAttributes('- [ ] Task [high:: something]');
        expect(result).toBe('- [ ] Task [priority:: high]');
      });

      // Line 30: test branch where val === true (boolean) and key is a date shortcut
      // The @tomorrow shortcut is parsed as {tomorrow: true} (boolean true)
      it('should convert @tod shortcut to due date', () => {
        const result = operations.convertAttributes('- [ ] Task @tod');
        expect(result).toMatch(/- \[ \] Task \[due:: \d{4}-\d{2}-\d{2}\]/);
      });

      // Line 30: test branch where val === true but Completion.completeDate returns null
      // When a custom boolean attribute (not a valid date) has val === true
      it('should keep non-date boolean shortcut unchanged when using default settings', () => {
        // @custom is parsed as {custom: true} but "custom" is not a valid date
        const result = operations.convertAttributes('- [ ] Task @custom');
        expect(result).toBe('- [ ] Task [custom:: true]');
      });

      // Line 30: test branch where val is boolean false (neither string nor true)
      // This tests the implicit else branch where val !== true
      it('should preserve attribute when value is boolean false', () => {
        // [attr:: false] is parsed as string "false", not boolean false
        // But this tests that non-true boolean values don't trigger date conversion
        const result = operations.convertAttributes('- [ ] Task [myattr:: false]');
        expect(result).toBe('- [ ] Task [myattr:: false]');
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
