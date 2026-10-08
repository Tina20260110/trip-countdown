import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { TripRepository } from '../../src/contracts/repositories';
import type { TripSummary } from '../../src/domain/types';
import { TripsScreen } from '../../src/features/trips/TripsScreen';
import type { TripsLifecycle } from '../../src/features/trips/useTrips';

function trip(overrides: Partial<TripSummary> = {}): TripSummary {
  return {
    id: 1,
    destination: '东京',
    departureDate: '2026-10-22',
    notes: '',
    createdAt: 1,
    updatedAt: 1,
    checklistProgress: { completed: 0, total: 0 },
    ...overrides,
  };
}

function repositoryWithList(
  list: TripRepository['list'],
): TripRepository {
  return {
    list,
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function testLifecycle(): TripsLifecycle {
  return {
    subscribeToActive: () => () => undefined,
    scheduleAtNextLocalMidnight: () => () => undefined,
  };
}

describe('TripsScreen', () => {
  it('distinguishes loading, empty, and error with retry', async () => {
    let resolveList!: (value: Awaited<ReturnType<TripRepository['list']>>) => void;
    const first = new Promise<Awaited<ReturnType<TripRepository['list']>>>((resolve) => {
      resolveList = resolve;
    });
    const list = jest
      .fn<ReturnType<TripRepository['list']>, Parameters<TripRepository['list']>>()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ ok: false, error: { kind: 'storage', message: 'secret SQL /path' } })
      .mockResolvedValueOnce({ ok: true, value: [] });

    await render(
      <TripsScreen
        repository={repositoryWithList(list)}
        getNow={() => new Date(2026, 9, 8, 12)}
        lifecycle={testLifecycle()}
        onCreateTrip={jest.fn()}
        onOpenTrip={jest.fn()}
      />,
    );
    expect(screen.getByText('正在加载旅行')).toBeTruthy();
    expect(screen.queryByText('还没有旅行')).toBeNull();

    resolveList({ ok: false, error: { kind: 'storage', message: 'secret SQL /path' } });
    expect(await screen.findByText('读取旅行失败，请重试')).toBeTruthy();
    expect(screen.queryByText(/secret|SQL|\/path/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('读取旅行失败，请重试')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('还没有旅行')).toBeTruthy();
    expect(screen.getByRole('button', { name: '创建旅行' })).toBeTruthy();
  });

  it('renders repository order, countdown states, and progress only when items exist', async () => {
    const list = jest.fn<ReturnType<TripRepository['list']>, Parameters<TripRepository['list']>>().mockResolvedValue({
      ok: true,
      value: [
        trip({ id: 2, destination: '上海', departureDate: '2026-10-08' }),
        trip({ id: 1, destination: '东京', checklistProgress: { completed: 1, total: 3 } }),
        trip({ id: 3, destination: '巴黎', departureDate: '2026-10-01' }),
      ],
    });

    await render(
      <TripsScreen
        repository={repositoryWithList(list)}
        getNow={() => new Date(2026, 9, 8, 12)}
        lifecycle={testLifecycle()}
        onCreateTrip={jest.fn()}
        onOpenTrip={jest.fn()}
      />,
    );

    expect(await screen.findByText('今天出发')).toBeTruthy();
    expect(screen.getByText('还有 14 天')).toBeTruthy();
    expect(screen.getByText('旅行已结束')).toBeTruthy();
    expect(screen.getByText('已完成 1 / 3')).toBeTruthy();
    expect(screen.queryByText('已完成 0 / 0')).toBeNull();
    const names = screen.getAllByRole('button').map((node) => node.props.accessibilityLabel);
    expect(names.slice(0, 3)).toEqual(['上海，今天出发', '东京，还有 14 天，已完成 1 / 3', '巴黎，旅行已结束']);
  });

  it('refreshes on foreground and local midnight with a newly read local date', async () => {
    let onActive: () => void = () => undefined;
    let onMidnight: () => void = () => undefined;
    const lifecycle: TripsLifecycle = {
      subscribeToActive(callback) {
        onActive = callback;
        return () => undefined;
      },
      scheduleAtNextLocalMidnight(_now, callback) {
        onMidnight = callback;
        return () => undefined;
      },
    };
    let now = new Date(2026, 9, 8, 23, 59);
    const list = jest.fn<ReturnType<TripRepository['list']>, Parameters<TripRepository['list']>>().mockResolvedValue({ ok: true, value: [] });

    await render(
      <TripsScreen
        repository={repositoryWithList(list)}
        getNow={() => now}
        lifecycle={lifecycle}
        onCreateTrip={jest.fn()}
        onOpenTrip={jest.fn()}
      />,
    );
    await waitFor(() => expect(list).toHaveBeenCalledWith('2026-10-08'));
    now = new Date(2026, 9, 9, 0, 1);
    onMidnight();
    await waitFor(() => expect(list).toHaveBeenCalledWith('2026-10-09'));
    onActive();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
  });

  it('refreshes when a mounted route receives a new focus signal', async () => {
    const list = jest.fn<ReturnType<TripRepository['list']>, Parameters<TripRepository['list']>>()
      .mockResolvedValue({ ok: true, value: [] });
    const props = {
      repository: repositoryWithList(list),
      getNow: () => new Date(2026, 9, 8, 12),
      lifecycle: testLifecycle(),
      onCreateTrip: jest.fn(),
      onOpenTrip: jest.fn(),
    };
    const view = await render(<TripsScreen {...props} focusSignal={0} />);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    await view.rerender(<TripsScreen {...props} focusSignal={1} />);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
});
