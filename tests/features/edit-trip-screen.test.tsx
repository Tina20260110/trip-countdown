import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { TripRepository } from '../../src/contracts/repositories';
import type { Trip } from '../../src/domain/types';
import { EditTripScreen } from '../../src/features/trips/EditTripScreen';
import type { ReminderCoordinator } from '../../src/features/reminders/reminder-coordinator';
import { detail, repositoryWithGet } from './trip-fixtures';

const updatedTrip: Trip = {
  id: 7, destination: '大阪', departureDate: '2020-01-02', notes: '新备注', createdAt: 1, updatedAt: 2,
};

describe('EditTripScreen', () => {
  it('loads persisted values and allows a valid past date', async () => {
    const update = jest.fn<ReturnType<TripRepository['update']>, Parameters<TripRepository['update']>>()
      .mockResolvedValue({ ok: true, value: updatedTrip });
    const repository = { ...repositoryWithGet(jest.fn().mockResolvedValue({ ok: true, value: detail() })), update };
    const onSaved = jest.fn();
    await render(<EditTripScreen tripId="7" repository={repository} onBack={jest.fn()} onSaved={onSaved} />);
    expect(await screen.findByDisplayValue('东京')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('目的地'), '大阪');
    await fireEvent.changeText(screen.getByLabelText('出发日期'), '2020-01-02');
    await fireEvent.changeText(screen.getByLabelText('备注'), '新备注');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(7, updatedTripInput()));
    expect(onSaved).toHaveBeenCalledWith(7);
  });

  it('rejects an invalid date without calling update', async () => {
    const update = jest.fn<ReturnType<TripRepository['update']>, Parameters<TripRepository['update']>>();
    const repository = { ...repositoryWithGet(jest.fn().mockResolvedValue({ ok: true, value: detail() })), update };
    await render(<EditTripScreen tripId="7" repository={repository} onBack={jest.fn()} onSaved={jest.fn()} />);
    await screen.findByDisplayValue('东京');
    await fireEvent.changeText(screen.getByLabelText('出发日期'), '2026-02-30');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));
    expect(await screen.findByText('请输入有效的出发日期')).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByLabelText('出发日期').props.value).toBe('2026-02-30');
  });

  it('preserves input after failure, retries, and prevents duplicate submission', async () => {
    let resolve!: (value: Awaited<ReturnType<TripRepository['update']>>) => void;
    const update = jest.fn<ReturnType<TripRepository['update']>, Parameters<TripRepository['update']>>()
      .mockResolvedValueOnce({ ok: false, error: { kind: 'storage', message: 'SQL /path' } })
      .mockReturnValueOnce(new Promise((next) => { resolve = next; }));
    const repository = { ...repositoryWithGet(jest.fn().mockResolvedValue({ ok: true, value: detail() })), update };
    const onSaved = jest.fn();
    await render(<EditTripScreen tripId="7" repository={repository} onBack={jest.fn()} onSaved={onSaved} />);
    await screen.findByDisplayValue('东京');
    await fireEvent.changeText(screen.getByLabelText('目的地'), '大阪');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));
    expect(await screen.findByText('保存失败，请重试')).toBeTruthy();
    expect(screen.getByLabelText('目的地').props.value).toBe('大阪');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));
    expect(await screen.findByRole('button', { name: '正在保存' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: '正在保存' }));
    expect(update).toHaveBeenCalledTimes(2);
    resolve({ ok: true, value: updatedTrip });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('shows a distinct not-found state for invalid or missing Trips', async () => {
    const repository = repositoryWithGet(jest.fn().mockResolvedValue({ ok: false, error: { kind: 'not-found', message: 'missing' } }));
    await render(<EditTripScreen tripId="7" repository={repository} onBack={jest.fn()} onSaved={jest.fn()} />);
    expect(await screen.findByText('旅行不存在')).toBeTruthy();
    expect(screen.getByRole('button', { name: '返回旅行详情' })).toBeTruthy();
  });

  it('reschedules reminders only after Trip commit succeeds', async () => {
    const update = jest
      .fn<ReturnType<TripRepository['update']>, Parameters<TripRepository['update']>>()
      .mockResolvedValue({ ok: true, value: updatedTrip });
    const repository = {
      ...repositoryWithGet(
        jest.fn().mockResolvedValue({ ok: true, value: detail() }),
      ),
      update,
    };
    const coordinator = {
      rescheduleForTrip: jest.fn().mockResolvedValue({ ok: true, value: [] }),
    } as Pick<ReminderCoordinator, 'rescheduleForTrip'>;
    const onSaved = jest.fn();
    await render(
      <EditTripScreen
        tripId="7"
        repository={repository}
        reminderCoordinator={coordinator}
        onBack={jest.fn()}
        onSaved={onSaved}
      />,
    );
    await screen.findByDisplayValue('东京');
    await fireEvent.changeText(screen.getByLabelText('出发日期'), '2020-01-02');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));

    await waitFor(() =>
      expect(coordinator.rescheduleForTrip).toHaveBeenCalledWith(7, '2020-01-02'),
    );
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(
      (coordinator.rescheduleForTrip as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(onSaved).toHaveBeenCalledWith(7);
  });

  it('reports reminder failure after Trip commit without retrying Trip update', async () => {
    const update = jest
      .fn<ReturnType<TripRepository['update']>, Parameters<TripRepository['update']>>()
      .mockResolvedValue({ ok: true, value: updatedTrip });
    const repository = {
      ...repositoryWithGet(
        jest.fn().mockResolvedValue({ ok: true, value: detail() }),
      ),
      update,
    };
    const coordinator = {
      rescheduleForTrip: jest.fn().mockResolvedValue({
        ok: false,
        error: {
          kind: 'scheduling',
          phase: 'schedule',
          message: 'private path Tokyo',
        },
      }),
    } as Pick<ReminderCoordinator, 'rescheduleForTrip'>;
    const onSaved = jest.fn();
    await render(
      <EditTripScreen
        tripId="7"
        repository={repository}
        reminderCoordinator={coordinator}
        onBack={jest.fn()}
        onSaved={onSaved}
      />,
    );
    await screen.findByDisplayValue('东京');
    await fireEvent.changeText(screen.getByLabelText('出发日期'), '2020-01-02');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));

    expect(
      await screen.findByText(
        '旅行已保存，但提醒更新失败。请在旅行详情中重试提醒。',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('保存失败，请重试')).toBeNull();
    expect(update).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();

    await fireEvent.press(
      screen.getByRole('button', { name: '返回旅行详情' }),
    );
    expect(onSaved).toHaveBeenCalledWith(7);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('does not reschedule when Trip update fails', async () => {
    const update = jest
      .fn<ReturnType<TripRepository['update']>, Parameters<TripRepository['update']>>()
      .mockResolvedValue({
        ok: false,
        error: { kind: 'storage', message: 'failure' },
      });
    const repository = {
      ...repositoryWithGet(
        jest.fn().mockResolvedValue({ ok: true, value: detail() }),
      ),
      update,
    };
    const coordinator = {
      rescheduleForTrip: jest.fn(),
    } as Pick<ReminderCoordinator, 'rescheduleForTrip'>;
    await render(
      <EditTripScreen
        tripId="7"
        repository={repository}
        reminderCoordinator={coordinator}
        onBack={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    await screen.findByDisplayValue('东京');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));

    expect(await screen.findByText('保存失败，请重试')).toBeTruthy();
    expect(coordinator.rescheduleForTrip).not.toHaveBeenCalled();
  });

  it('does not misreport a committed Trip when reminder coordination throws', async () => {
    const update = jest
      .fn<ReturnType<TripRepository['update']>, Parameters<TripRepository['update']>>()
      .mockResolvedValue({ ok: true, value: updatedTrip });
    const repository = {
      ...repositoryWithGet(
        jest.fn().mockResolvedValue({ ok: true, value: detail() }),
      ),
      update,
    };
    const coordinator = {
      rescheduleForTrip: jest.fn().mockRejectedValue(new Error('/private Tokyo')),
    } as Pick<ReminderCoordinator, 'rescheduleForTrip'>;
    await render(
      <EditTripScreen
        tripId="7"
        repository={repository}
        reminderCoordinator={coordinator}
        onBack={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    await screen.findByDisplayValue('东京');
    await fireEvent.changeText(screen.getByLabelText('出发日期'), '2020-01-02');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));

    expect(
      await screen.findByText(
        '旅行已保存，但提醒更新失败。请在旅行详情中重试提醒。',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('保存失败，请重试')).toBeNull();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('does not reschedule when only non-date fields change', async () => {
    const update = jest
      .fn<ReturnType<TripRepository['update']>, Parameters<TripRepository['update']>>()
      .mockResolvedValue({
        ok: true,
        value: { ...updatedTrip, departureDate: '2026-10-22' },
      });
    const repository = {
      ...repositoryWithGet(
        jest.fn().mockResolvedValue({ ok: true, value: detail() }),
      ),
      update,
    };
    const coordinator = {
      rescheduleForTrip: jest.fn(),
    } as Pick<ReminderCoordinator, 'rescheduleForTrip'>;
    const onSaved = jest.fn();
    await render(
      <EditTripScreen
        tripId="7"
        repository={repository}
        reminderCoordinator={coordinator}
        onBack={jest.fn()}
        onSaved={onSaved}
      />,
    );
    await screen.findByDisplayValue('东京');
    await fireEvent.changeText(screen.getByLabelText('备注'), '只改备注');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(7));
    expect(coordinator.rescheduleForTrip).not.toHaveBeenCalled();
  });
});

function updatedTripInput() {
  return { destination: '大阪', departureDate: '2020-01-02', notes: '新备注' };
}
