import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { ReminderRepository } from '../../src/contracts/repositories';
import type { ReminderCoordinator } from '../../src/features/reminders/reminder-coordinator';
import { ReminderSection } from '../../src/features/reminders/ReminderSection';
import { FakeReminderRepository, reminder } from '../reminders/fixtures/coordinator-fakes';

function coordinator(): jest.Mocked<Pick<ReminderCoordinator, 'enable' | 'disable'>> {
  return { enable: jest.fn(), disable: jest.fn() };
}

describe('ReminderSection', () => {
  it('loads both offsets without requesting permission during ordinary browsing', async () => {
    const repository = new FakeReminderRepository([
      reminder(),
      reminder({ offsetDays: 1, notificationId: 'trip-1-before-1', status: 'disabled', enabled: false }),
    ]);
    const actions = coordinator();
    await render(<ReminderSection tripId={1} departureDate="2026-10-20" repository={repository} coordinator={actions} platform="android" />);
    expect(await screen.findByText('提前 7 天')).toBeTruthy();
    expect(screen.getByText('提前 1 天')).toBeTruthy();
    expect(screen.getByText(/设备当前本地时区.*09:00/)).toBeTruthy();
    expect(screen.getByText(/尽力调度.*可能延迟/)).toBeTruthy();
    expect(screen.getByText(/应用关闭期间切换时区不保证自动跟随/)).toBeTruthy();
    expect(actions.enable).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '关闭提前 7 天提醒' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '开启提前 1 天提醒' })).toBeTruthy();
  });

  it('enables only after an explicit press and re-reads persisted state', async () => {
    const repository = new FakeReminderRepository();
    const actions = coordinator();
    actions.enable.mockImplementation(async (input) => {
      const value = reminder({ tripId: input.tripId, offsetDays: input.offsetDays, notificationId: `trip-${input.tripId}-before-${input.offsetDays}` });
      repository.values.set(`${input.tripId}:${input.offsetDays}`, value);
      return { ok: true, value };
    });
    await render(<ReminderSection tripId={1} departureDate="2026-10-20" repository={repository} coordinator={actions} />);
    await fireEvent.press(await screen.findByRole('button', { name: '开启提前 7 天提醒' }));
    expect(actions.enable).toHaveBeenCalledWith({ tripId: 1, offsetDays: 7, departureDate: '2026-10-20' });
    expect(await screen.findByText('已安排')).toBeTruthy();
    expect(repository.calls.filter((value) => value === 'list:1')).toHaveLength(2);
  });

  it('disables a scheduled reminder and prevents rapid duplicate operations', async () => {
    const repository = new FakeReminderRepository([reminder()]);
    const actions = coordinator();
    const disabled = reminder({ enabled: false, status: 'disabled', revision: 3 });
    let resolve!: (value: Awaited<ReturnType<ReminderCoordinator['disable']>>) => void;
    actions.disable.mockReturnValue(new Promise((next) => { resolve = next; }));
    await render(<ReminderSection tripId={1} departureDate="2026-10-20" repository={repository} coordinator={actions} />);
    const button = await screen.findByRole('button', { name: '关闭提前 7 天提醒' });
    await fireEvent.press(button);
    const busy = await screen.findByRole('button', { name: '正在更新提醒' });
    await fireEvent.press(busy);
    expect(actions.disable).toHaveBeenCalledTimes(1);
    repository.values.set('1:7', disabled);
    await act(async () => {
      resolve({ ok: true, value: disabled });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(await screen.findByRole('button', { name: '开启提前 7 天提醒' })).toBeEnabled();
  });

  it.each([
    ['permission_denied', '通知权限未开启，提醒未启用'],
    ['unavailable', '当前无法安排提醒'],
    ['error', '提醒更新失败，请重试'],
  ] as const)('shows %s with perceptible Chinese status', async (status, label) => {
    const repository = new FakeReminderRepository([reminder({ status })]);
    await render(<ReminderSection tripId={1} departureDate="2026-10-20" repository={repository} coordinator={coordinator()} />);
    expect(await screen.findByText(label)).toHaveProp('accessibilityRole', 'alert');
    expect(screen.getByRole('button', { name: '重试提前 7 天提醒' })).toBeTruthy();
  });

  it('distinguishes read failure from no reminders and retries', async () => {
    const list = jest.fn()
      .mockResolvedValueOnce({ ok: false, error: { kind: 'storage', message: 'SQL /private Tokyo' } })
      .mockResolvedValueOnce({ ok: true, value: [] });
    const repository = { list, get: jest.fn(), create: jest.fn(), updateIfRevision: jest.fn() } as ReminderRepository;
    await render(<ReminderSection tripId={1} departureDate="2026-10-20" repository={repository} coordinator={coordinator()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('读取提醒失败，请重试');
    expect(screen.queryByText(/SQL|private|Tokyo/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: '开启提前 7 天提醒' })).toBeTruthy();
  });

  it('turns a rejected read into a safe retryable error', async () => {
    const list = jest.fn()
      .mockRejectedValueOnce(new Error('SELECT /private Tokyo'))
      .mockResolvedValueOnce({ ok: true, value: [] });
    const repository = { list, get: jest.fn(), create: jest.fn(), updateIfRevision: jest.fn() } as ReminderRepository;
    await render(<ReminderSection tripId={1} departureDate="2026-10-20" repository={repository} coordinator={coordinator()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('读取提醒失败，请重试');
    expect(screen.queryByText(/SELECT|private|Tokyo/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByRole('button', { name: '开启提前 7 天提醒' })).toBeTruthy();
  });
});
