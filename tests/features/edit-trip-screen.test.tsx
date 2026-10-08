import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { TripRepository } from '../../src/contracts/repositories';
import type { Trip } from '../../src/domain/types';
import { EditTripScreen } from '../../src/features/trips/EditTripScreen';
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
});

function updatedTripInput() {
  return { destination: '大阪', departureDate: '2020-01-02', notes: '新备注' };
}
