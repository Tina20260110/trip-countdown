import type {
  ChecklistItem,
  CreateTripInput,
  DomainError,
  EditTripInput,
  ReminderOffset,
  ReminderStatus,
  Result,
  TripDetail,
  TripSummary,
} from '@/src/domain/types';

const reminderStatuses = [
  'disabled',
  'pending',
  'scheduled',
  'permission_denied',
  'unavailable',
  'error',
] as const satisfies readonly ReminderStatus[];

const reminderOffsets = [1, 7] as const satisfies readonly ReminderOffset[];

describe('domain types', () => {
  it('defines the complete reminder enums', () => {
    expect(reminderStatuses).toEqual([
      'disabled',
      'pending',
      'scheduled',
      'permission_denied',
      'unavailable',
      'error',
    ]);
    expect(reminderOffsets).toEqual([1, 7]);
  });

  it('keeps create and edit inputs independent from persistence rows', () => {
    const createInput: CreateTripInput = {
      destination: 'Tokyo',
      departureDate: '2026-12-01',
      notes: '',
    };
    const editInput: EditTripInput = { ...createInput, departureDate: '2025-12-01' };

    expect(createInput).not.toHaveProperty('id');
    expect(editInput.departureDate).toBe('2025-12-01');
  });

  it('composes summary and detail models from domain entities', () => {
    const checklistItem: ChecklistItem = {
      id: 10,
      tripId: 1,
      title: 'Passport',
      completed: false,
      createdAt: 1_700_000_000_000,
    };
    const summary: TripSummary = {
      id: 1,
      destination: 'Tokyo',
      departureDate: '2026-12-01',
      notes: '',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      checklistProgress: { completed: 0, total: 1 },
    };
    const detail: TripDetail = {
      ...summary,
      checklistItems: [checklistItem],
      reminders: [],
    };

    expect(detail.checklistItems).toEqual([checklistItem]);
    expect(summary.checklistProgress).toEqual({ completed: 0, total: 1 });
  });

  it('uses discriminated results and typed errors', () => {
    const result: Result<string> = {
      ok: false,
      error: { kind: 'not-found', message: '旅行不存在' },
    };

    if (!result.ok) {
      const error: DomainError = result.error;
      expect(error.kind).toBe('not-found');
    }
  });
});
