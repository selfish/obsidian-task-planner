import { Consts } from '../../src/types/constants';

describe('Consts', () => {
  it('should have TaskItemDragType constant', () => {
    expect(Consts.TaskItemDragType).toBe('application/x-task-id');
  });

  it('should have TaskGroupDragType constant', () => {
    expect(Consts.TaskGroupDragType).toBe('application/x-task-group-ids');
  });
});
