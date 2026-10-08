import type { ChecklistRepository, TripRepository } from '../../src/contracts/repositories';
import type { TripDetail } from '../../src/domain/types';

export function detail(overrides: Partial<TripDetail> = {}): TripDetail {
  return {
    id: 7,
    destination: '东京',
    departureDate: '2026-10-22',
    notes: '准备护照',
    createdAt: 1,
    updatedAt: 1,
    checklistItems: [],
    reminders: [],
    ...overrides,
  };
}

export function repositoryWithGet(get: TripRepository['get']): TripRepository {
  return { list: jest.fn(), get, create: jest.fn(), update: jest.fn(), delete: jest.fn() };
}

export function emptyChecklistRepository(): ChecklistRepository {
  return {
    list: jest.fn().mockResolvedValue({ ok: true, value: [] }),
    add: jest.fn(),
    setCompleted: jest.fn(),
    remove: jest.fn(),
  };
}
