import { Consts } from '../../src/types/constants';

describe('Consts', () => {
  it('should have TodoItemDragType constant', () => {
    expect(Consts.TodoItemDragType).toBe('application/x-todo-id');
  });

  it('should have TodoGroupDragType constant', () => {
    expect(Consts.TodoGroupDragType).toBe('application/x-todo-group-ids');
  });
});
