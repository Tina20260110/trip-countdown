import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import type {
  ChecklistRepository,
  ReminderRepository,
  TripRepository,
} from '../../src/contracts/repositories';
import type {
  ChecklistItem,
  Reminder,
  ReminderOffset,
  Trip,
} from '../../src/domain/types';
import { BootstrapGate } from '../../src/features/bootstrap/BootstrapGate';
import type { AppDependencies } from '../../src/features/bootstrap/types';
import { ChecklistSection } from '../../src/features/checklist/ChecklistSection';
import { ReminderSection } from '../../src/features/reminders/ReminderSection';
import type { ReminderCoordinator } from '../../src/features/reminders/reminder-coordinator';
import { CreateTripScreen } from '../../src/features/trips/CreateTripScreen';
import { EditTripScreen } from '../../src/features/trips/EditTripScreen';
import { TripDetailScreen } from '../../src/features/trips/TripDetailScreen';
import { TripsScreen } from '../../src/features/trips/TripsScreen';
import type { TripsLifecycle } from '../../src/features/trips/useTrips';

const lifecycle: TripsLifecycle = {
  subscribeToActive: () => () => undefined,
  scheduleAtNextLocalMidnight: () => () => undefined,
};

function createMemoryApp() {
  let trip: Trip | undefined;
  let nextChecklistId = 1;
  const checklist: ChecklistItem[] = [];
  const reminders = new Map<ReminderOffset, Reminder>();

  const tripRepository: TripRepository = {
    list: jest.fn(async () => ({
      ok: true as const,
      value: trip
        ? [{
            ...trip,
            checklistProgress: {
              completed: checklist.filter((item) => item.completed).length,
              total: checklist.length,
            },
          }]
        : [],
    })),
    get: jest.fn(async (id) => trip && trip.id === id
      ? { ok: true as const, value: { ...trip, checklistItems: [...checklist], reminders: [...reminders.values()] } }
      : { ok: false as const, error: { kind: 'not-found' as const, message: 'missing' } }),
    create: jest.fn(async (input) => {
      trip = { ...input, id: 1, createdAt: 1, updatedAt: 1 };
      return { ok: true as const, value: trip };
    }),
    update: jest.fn(async (id, input) => {
      if (!trip || trip.id !== id) {
        return { ok: false as const, error: { kind: 'not-found' as const, message: 'missing' } };
      }
      trip = { ...trip, ...input, updatedAt: trip.updatedAt + 1 };
      return { ok: true as const, value: trip };
    }),
    delete: jest.fn(async () => {
      trip = undefined;
      checklist.splice(0);
      reminders.clear();
      return { ok: true as const, value: undefined };
    }),
  };

  const checklistRepository: ChecklistRepository = {
    list: jest.fn(async (tripId) => ({
      ok: true as const,
      value: checklist.filter((item) => item.tripId === tripId),
    })),
    add: jest.fn(async (tripId, input) => {
      const value = { id: nextChecklistId++, tripId, title: input.title, completed: false, createdAt: Date.now() };
      checklist.push(value);
      return { ok: true as const, value };
    }),
    setCompleted: jest.fn(async (itemId, completed) => {
      const index = checklist.findIndex((item) => item.id === itemId);
      const value = { ...checklist[index], completed } as ChecklistItem;
      checklist[index] = value;
      return { ok: true as const, value };
    }),
    remove: jest.fn(async (itemId) => {
      const index = checklist.findIndex((item) => item.id === itemId);
      checklist.splice(index, 1);
      return { ok: true as const, value: undefined };
    }),
  };

  const reminderRepository: ReminderRepository = {
    list: jest.fn(async (tripId) => ({
      ok: true as const,
      value: [...reminders.values()].filter((value) => value.tripId === tripId),
    })),
    get: jest.fn(),
    create: jest.fn(),
    updateIfRevision: jest.fn(),
  };

  const reminderCoordinator: Pick<ReminderCoordinator, 'enable' | 'disable' | 'rescheduleForTrip'> = {
    enable: jest.fn(async ({ tripId, offsetDays }) => {
      const value: Reminder = {
        tripId,
        offsetDays,
        enabled: true,
        status: 'scheduled',
        revision: 1,
        notificationId: `trip-${tripId}-before-${offsetDays}`,
        targetDate: '2026-10-15',
        scheduledAt: 1,
        scheduledTimezone: 'Asia/Shanghai',
        errorCode: null,
      };
      reminders.set(offsetDays, value);
      return { ok: true as const, value };
    }),
    disable: jest.fn(),
    rescheduleForTrip: jest.fn(async () => ({ ok: true as const, value: [...reminders.values()] })),
  };

  return { tripRepository, checklistRepository, reminderRepository, reminderCoordinator };
}

describe('core app flows', () => {
  it('prevents a rapid duplicate Trip submission while persistence is pending', async () => {
    let resolve!: (value: { ok: true; value: Trip }) => void;
    const create = jest.fn(() => new Promise<{ ok: true; value: Trip }>((next) => { resolve = next; }));
    const repository = {
      list: jest.fn(),
      get: jest.fn(),
      create,
      update: jest.fn(),
      delete: jest.fn(),
    } as TripRepository;
    const onCreated = jest.fn();
    await render(
      <CreateTripScreen repository={repository} getNow={() => new Date(2026, 9, 10)} onCreated={onCreated} />,
    );
    await fireEvent.changeText(screen.getByLabelText('目的地'), '东京');
    await fireEvent.changeText(screen.getByLabelText('出发日期'), '2026-10-20');
    const save = screen.getByRole('button', { name: '保存旅行' });
    await fireEvent.press(save);
    const busy = screen.getByRole('button', { name: '正在保存' });
    await fireEvent.press(busy);
    expect(create).toHaveBeenCalledTimes(1);
    expect(busy).toBeDisabled();
    resolve({
      ok: true,
      value: {
        id: 1,
        destination: '东京',
        departureDate: '2026-10-20',
        notes: '',
        createdAt: 1,
        updatedAt: 1,
      },
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  it('keeps persisted Trip, Checklist and Reminder data consistent across feature remounts', async () => {
    const app = createMemoryApp();
    const created = jest.fn();
    const createView = await render(
      <CreateTripScreen repository={app.tripRepository} getNow={() => new Date(2026, 9, 10)} onCreated={created} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));
    expect(screen.getAllByRole('alert').some((alert) => alert.props.children === '请输入目的地')).toBe(true);
    expect(app.tripRepository.create).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('目的地'), ' 东京 ');
    await fireEvent.changeText(screen.getByLabelText('出发日期'), '2026-10-20');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));
    expect(created).toHaveBeenCalledTimes(1);
    await createView.unmount();

    const listView = await render(
      <TripsScreen repository={app.tripRepository} getNow={() => new Date(2026, 9, 10)} lifecycle={lifecycle} onCreateTrip={jest.fn()} onOpenTrip={jest.fn()} />,
    );
    expect(await screen.findByText('东京')).toBeTruthy();
    await listView.unmount();

    const checklistView = await render(<ChecklistSection tripId={1} repository={app.checklistRepository} />);
    expect(await screen.findByText('还没有准备事项')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('事项名称'), ' 护照 ');
    await fireEvent.press(screen.getByRole('button', { name: '添加事项' }));
    const checkbox = await screen.findByRole('checkbox', { name: '护照，待完成' });
    await fireEvent.press(checkbox);
    expect(await screen.findByText('已完成 1 / 1')).toBeTruthy();
    await checklistView.unmount();

    const reminderView = await render(
      <ReminderSection
        tripId={1}
        departureDate="2026-10-20"
        repository={app.reminderRepository}
        coordinator={app.reminderCoordinator}
      />,
    );
    await fireEvent.press(await screen.findByRole('button', { name: '开启提前 7 天提醒' }));
    expect(await screen.findByText('已安排')).toBeTruthy();
    await reminderView.unmount();

    const detailView = await render(
      <TripDetailScreen
        tripId="1"
        repository={app.tripRepository}
        checklistRepository={app.checklistRepository}
        reminderRepository={app.reminderRepository}
        reminderCoordinator={app.reminderCoordinator}
        getNow={() => new Date(2026, 9, 10)}
        onBack={jest.fn()}
        onEdit={jest.fn()}
        onDeleted={jest.fn()}
      />,
    );
    expect(await screen.findByText('护照')).toBeTruthy();
    expect(screen.getByText('已完成 1 / 1')).toBeTruthy();
    expect(screen.getByText('已安排')).toBeTruthy();
    await detailView.unmount();

    const saved = jest.fn();
    await render(
      <EditTripScreen tripId="1" repository={app.tripRepository} reminderCoordinator={app.reminderCoordinator} onBack={jest.fn()} onSaved={saved} />,
    );
    await screen.findByDisplayValue('东京');
    await fireEvent.changeText(screen.getByLabelText('目的地'), '大阪');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));
    expect(saved).toHaveBeenCalledWith(1);
    expect(app.reminderCoordinator.rescheduleForTrip).not.toHaveBeenCalled();
  });

  it('keeps Bootstrap unavailable until dependencies are ready', async () => {
    let resolve!: (value: { ok: true; value: AppDependencies }) => void;
    const initialize = jest.fn(() => new Promise<{ ok: true; value: AppDependencies }>((next) => { resolve = next; }));
    await render(<BootstrapGate bootstrap={{ initialize }}><Text>业务页面</Text></BootstrapGate>);
    expect(screen.getByText('正在加载')).toBeTruthy();
    expect(screen.queryByText('业务页面')).toBeNull();
    resolve({ ok: true, value: {} as AppDependencies });
    expect(await screen.findByText('业务页面')).toBeTruthy();
  });

  it('turns rejected reads into safe retryable terminal states', async () => {
    const secret = 'SQL /private/Tokyo Notes Passport';
    const list = jest.fn()
      .mockRejectedValueOnce(new Error(secret))
      .mockResolvedValueOnce({ ok: true, value: [] });
    const repository = {
      list,
      get: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as TripRepository;
    await render(
      <TripsScreen repository={repository} getNow={() => new Date(2026, 9, 10)} lifecycle={lifecycle} onCreateTrip={jest.fn()} onOpenTrip={jest.fn()} />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('读取旅行失败，请重试');
    expect(screen.queryByText(/SQL|private|Tokyo|Notes|Passport/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('还没有旅行')).toBeTruthy();
  });

  it('recovers when reminder coordination rejects without leaving a busy control', async () => {
    const app = createMemoryApp();
    const coordinator = {
      enable: jest.fn()
        .mockRejectedValueOnce(new Error('SQL /private Tokyo'))
        .mockResolvedValueOnce({ ok: false, error: { kind: 'unavailable', phase: 'schedule', message: 'raw' } }),
      disable: jest.fn(),
    } as Pick<ReminderCoordinator, 'enable' | 'disable'>;
    await render(
      <ReminderSection tripId={1} departureDate="2026-10-20" repository={app.reminderRepository} coordinator={coordinator} />,
    );
    await fireEvent.press(await screen.findByRole('button', { name: '开启提前 7 天提醒' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('提醒更新失败，请重试');
    expect(screen.queryByText(/SQL|private|Tokyo|raw/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '重试提前 7 天提醒' }));
    await waitFor(() => expect(coordinator.enable).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: '重试提前 7 天提醒' })).toBeEnabled();
  });
});
