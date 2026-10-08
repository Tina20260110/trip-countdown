import { calculateChecklistProgress } from '@/src/domain/checklist-progress';

describe('calculateChecklistProgress', () => {
  it('returns no progress model for an empty checklist', () => {
    expect(calculateChecklistProgress([])).toBeNull();
  });

  it('counts completed and total items with Chinese text', () => {
    const items = [{ completed: true }, { completed: false }, { completed: true }];

    expect(calculateChecklistProgress(items)).toEqual({
      completed: 2,
      total: 3,
      label: '已完成 2 / 3',
    });
  });

  it('handles an entirely completed checklist', () => {
    const items = [{ completed: true }, { completed: true }];

    expect(calculateChecklistProgress(items)).toEqual({
      completed: 2,
      total: 2,
      label: '已完成 2 / 2',
    });
  });

  it('does not mutate the input collection or items', () => {
    const pending = Object.freeze({ completed: false });
    const completed = Object.freeze({ completed: true });
    const items = Object.freeze([pending, completed]);

    calculateChecklistProgress(items);

    expect(items).toEqual([pending, completed]);
    expect(pending.completed).toBe(false);
    expect(completed.completed).toBe(true);
  });
});
