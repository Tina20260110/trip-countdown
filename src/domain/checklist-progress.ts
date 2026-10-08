import type { ChecklistItem, ChecklistProgress } from './types';

type ChecklistCompletion = Pick<ChecklistItem, 'completed'>;

export interface ChecklistProgressDisplay extends ChecklistProgress {
  label: string;
}

export function formatChecklistProgress(
  progress: ChecklistProgress,
): ChecklistProgressDisplay | null {
  if (progress.total === 0) return null;
  return { ...progress, label: `已完成 ${progress.completed} / ${progress.total}` };
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

  return formatChecklistProgress({ completed, total });
}
