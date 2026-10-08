import type { ChecklistItem, ChecklistProgress } from './types';

type ChecklistCompletion = Pick<ChecklistItem, 'completed'>;

export interface ChecklistProgressDisplay extends ChecklistProgress {
  label: string;
}

export function calculateChecklistProgress(
  items: readonly ChecklistCompletion[],
): ChecklistProgressDisplay | null {
  if (items.length === 0) {
    return null;
  }

  const completed = items.reduce(
    (count, item) => count + (item.completed ? 1 : 0),
    0,
  );
  const total = items.length;

  return {
    completed,
    total,
    label: `已完成 ${completed} / ${total}`,
  };
}
