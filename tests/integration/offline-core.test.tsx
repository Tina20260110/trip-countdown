import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { ChecklistRepository, TripRepository } from '../../src/contracts/repositories';
import type { ChecklistItem, Trip } from '../../src/domain/types';
import { ChecklistSection } from '../../src/features/checklist/ChecklistSection';
import { CreateTripScreen } from '../../src/features/trips/CreateTripScreen';
import { EditTripScreen } from '../../src/features/trips/EditTripScreen';
import { TripDetailScreen } from '../../src/features/trips/TripDetailScreen';
import { TripsScreen } from '../../src/features/trips/TripsScreen';
import type { TripsLifecycle } from '../../src/features/trips/useTrips';

const lifecycle: TripsLifecycle = {
  subscribeToActive: () => () => undefined,
  scheduleAtNextLocalMidnight: () => () => undefined,
};

describe('offline core flow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('completes Trip CRUD, Countdown and Checklist without a network call', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    let trip: Trip | undefined;
    const items: ChecklistItem[] = [];
    const trips: TripRepository = {
      list: jest.fn(async () => ({
        ok: true as const,
        value: trip ? [{ ...trip, checklistProgress: { completed: items.filter((item) => item.completed).length, total: items.length } }] : [],
      })),
      get: jest.fn(async (id) => trip?.id === id
        ? { ok: true as const, value: { ...trip, checklistItems: [...items], reminders: [] } }
        : { ok: false as const, error: { kind: 'not-found' as const, message: 'missing' } }),
      create: jest.fn(async (input) => {
        trip = { ...input, id: 1, createdAt: 1, updatedAt: 1 };
        return { ok: true as const, value: trip };
      }),
      update: jest.fn(async (_id, input) => {
        trip = { ...trip!, ...input, updatedAt: 2 };
        return { ok: true as const, value: trip };
      }),
      delete: jest.fn(async () => {
        trip = undefined;
        items.splice(0);
        return { ok: true as const, value: undefined };
      }),
    };
    const checklist: ChecklistRepository = {
      list: jest.fn(async (tripId) => ({ ok: true as const, value: items.filter((item) => item.tripId === tripId) })),
      add: jest.fn(async (tripId, input) => {
        const value: ChecklistItem = { id: 1, tripId, title: input.title, completed: false, createdAt: 1 };
        items.push(value);
        return { ok: true as const, value };
      }),
      setCompleted: jest.fn(async (id, completed) => {
        const index = items.findIndex((item) => item.id === id);
        items[index] = { ...items[index], completed } as ChecklistItem;
        return { ok: true as const, value: items[index] };
      }),
      remove: jest.fn(async (id) => {
        items.splice(items.findIndex((item) => item.id === id), 1);
        return { ok: true as const, value: undefined };
      }),
    };

    const create = await render(<CreateTripScreen repository={trips} getNow={() => new Date(2026, 9, 10)} onCreated={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('目的地'), '东京');
    await fireEvent.changeText(screen.getByLabelText('出发日期'), '2026-10-20');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));
    await waitFor(() => expect(trips.create).toHaveBeenCalledTimes(1));
    await create.unmount();

    const list = await render(<TripsScreen repository={trips} getNow={() => new Date(2026, 9, 10)} lifecycle={lifecycle} onCreateTrip={jest.fn()} onOpenTrip={jest.fn()} />);
    expect(await screen.findByText('还有 10 天')).toBeTruthy();
    await list.unmount();

    const prepare = await render(<ChecklistSection tripId={1} repository={checklist} />);
    await fireEvent.changeText(await screen.findByLabelText('事项名称'), '护照');
    await fireEvent.press(screen.getByRole('button', { name: '添加事项' }));
    await fireEvent.press(await screen.findByRole('checkbox', { name: '护照，待完成' }));
    expect(await screen.findByText('已完成 1 / 1')).toBeTruthy();
    await prepare.unmount();

    const edit = await render(<EditTripScreen tripId="1" repository={trips} onBack={jest.fn()} onSaved={jest.fn()} />);
    await screen.findByDisplayValue('东京');
    await fireEvent.changeText(screen.getByLabelText('目的地'), '大阪');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));
    await waitFor(() => expect(trips.update).toHaveBeenCalledTimes(1));
    await edit.unmount();

    const detail = await render(
      <TripDetailScreen
        tripId="1"
        repository={trips}
        checklistRepository={checklist}
        deletionPort={{ deleteTrip: async (id) => {
          const result = await trips.delete(id);
          return result.ok ? { ok: true as const, value: undefined } : { ok: false as const, error: { kind: 'failed' as const } };
        } }}
        getNow={() => new Date(2026, 9, 10)}
        onBack={jest.fn()}
        onEdit={jest.fn()}
        onDeleted={jest.fn()}
      />,
    );
    expect(await screen.findByText('大阪')).toBeTruthy();
    expect(screen.getByText('护照')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '删除旅行' }));
    await fireEvent.press(screen.getByRole('button', { name: '确认删除' }));
    await waitFor(() => expect(trips.delete).toHaveBeenCalledTimes(1));
    await detail.unmount();

    await render(<TripsScreen repository={trips} getNow={() => new Date(2026, 9, 10)} lifecycle={lifecycle} onCreateTrip={jest.fn()} onOpenTrip={jest.fn()} />);
    expect(await screen.findByText('还没有旅行')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
