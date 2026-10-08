import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { ChecklistRepository, TripRepository } from '../../src/contracts/repositories';
import type { ChecklistItem, TripSummary } from '../../src/domain/types';
import { TripDetailScreen } from '../../src/features/trips/TripDetailScreen';
import { TripsScreen } from '../../src/features/trips/TripsScreen';
import type { TripsLifecycle } from '../../src/features/trips/useTrips';
import { detail, repositoryWithGet } from './trip-fixtures';

const passport: ChecklistItem = { id: 1, tripId: 7, title: '护照', completed: false, createdAt: 1 };

function checklistRepository(overrides: Partial<ChecklistRepository>): ChecklistRepository {
  return { list: jest.fn(), add: jest.fn(), setCompleted: jest.fn(), remove: jest.fn(), ...overrides };
}

const lifecycle: TripsLifecycle = {
  subscribeToActive: () => () => undefined,
  scheduleAtNextLocalMidnight: () => () => undefined,
};

describe('Checklist Trip integration', () => {
  it('mounts the scoped Checklist in Detail and refreshes it on focus', async () => {
    const list = jest.fn()
      .mockResolvedValueOnce({ ok: true, value: [] })
      .mockResolvedValueOnce({ ok: true, value: [passport] });
    const checklist = checklistRepository({ list });
    const props = {
      tripId: '7', repository: repositoryWithGet(jest.fn().mockResolvedValue({ ok: true, value: detail() })),
      checklistRepository: checklist, getNow: () => new Date(2026, 9, 8),
      onBack: jest.fn(), onEdit: jest.fn(), onDeleted: jest.fn(),
    };
    const view = await render(<TripDetailScreen {...props} focusSignal={0} />);
    expect(await screen.findByText('还没有准备事项')).toBeTruthy();
    await view.rerender(<TripDetailScreen {...props} focusSignal={1} />);
    expect(await screen.findByText('护照')).toBeTruthy();
    expect(list).toHaveBeenNthCalledWith(1, 7);
    expect(list).toHaveBeenNthCalledWith(2, 7);
  });

  it('re-reads one aggregate Trip query on focus and reflects progress from zero to nonzero to zero', async () => {
    const summary = (completed: number, total: number): TripSummary => ({
      id: 7, destination: '东京', departureDate: '2026-10-22', notes: '', createdAt: 1, updatedAt: 1,
      checklistProgress: { completed, total },
    });
    const list = jest.fn<ReturnType<TripRepository['list']>, Parameters<TripRepository['list']>>()
      .mockResolvedValueOnce({ ok: true, value: [summary(0, 0)] })
      .mockResolvedValueOnce({ ok: true, value: [summary(1, 2)] })
      .mockResolvedValueOnce({ ok: true, value: [summary(0, 0)] });
    const repository: TripRepository = { list, get: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
    const props = { repository, getNow: () => new Date(2026, 9, 8), lifecycle, onCreateTrip: jest.fn(), onOpenTrip: jest.fn() };
    const view = await render(<TripsScreen {...props} focusSignal={0} />);
    expect(await screen.findByText('东京')).toBeTruthy();
    expect(screen.queryByText('已完成 0 / 0')).toBeNull();
    await view.rerender(<TripsScreen {...props} focusSignal={1} />);
    expect(await screen.findByText('已完成 1 / 2')).toBeTruthy();
    await view.rerender(<TripsScreen {...props} focusSignal={2} />);
    await waitFor(() => expect(screen.queryByText('已完成 1 / 2')).toBeNull());
    expect(screen.queryByText('已完成 0 / 0')).toBeNull();
    expect(list).toHaveBeenCalledTimes(3);
  });
});
