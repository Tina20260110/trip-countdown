import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { TripRepository } from '../../src/contracts/repositories';
import type { TripDeletionPort } from '../../src/features/trips/trip-deletion-port';
import { TripDetailScreen } from '../../src/features/trips/TripDetailScreen';
import { detail, repositoryWithGet } from './trip-fixtures';

function screenProps(port: TripDeletionPort, onDeleted = jest.fn()) {
  const get = jest.fn<ReturnType<TripRepository['get']>, Parameters<TripRepository['get']>>()
    .mockResolvedValue({ ok: true, value: detail() });
  return {
    tripId: '7', repository: repositoryWithGet(get), deletionPort: port,
    getNow: () => new Date(2026, 9, 8), onBack: jest.fn(), onEdit: jest.fn(), onDeleted,
  };
}

describe('Trip delete UI coordination shell', () => {
  it('requires confirmation and cancel performs zero writes', async () => {
    const deleteTrip = jest.fn<ReturnType<TripDeletionPort['deleteTrip']>, Parameters<TripDeletionPort['deleteTrip']>>();
    await render(<TripDetailScreen {...screenProps({ deleteTrip })} />);
    await fireEvent.press(await screen.findByRole('button', { name: '删除旅行' }));
    expect(screen.getByText('确定删除这次旅行吗？')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '取消删除' }));
    expect(deleteTrip).not.toHaveBeenCalled();
    expect(screen.queryByText('确定删除这次旅行吗？')).toBeNull();
    expect(screen.getByText('东京')).toBeTruthy();
  });

  it('prevents repeated confirmation and returns to Trips only after success', async () => {
    let resolve!: (value: Awaited<ReturnType<TripDeletionPort['deleteTrip']>>) => void;
    const deleteTrip = jest.fn<ReturnType<TripDeletionPort['deleteTrip']>, Parameters<TripDeletionPort['deleteTrip']>>()
      .mockReturnValue(new Promise((next) => { resolve = next; }));
    const onDeleted = jest.fn();
    await render(<TripDetailScreen {...screenProps({ deleteTrip }, onDeleted)} />);
    await fireEvent.press(await screen.findByRole('button', { name: '删除旅行' }));
    await fireEvent.press(screen.getByRole('button', { name: '确认删除' }));
    const busy = await screen.findByRole('button', { name: '正在删除' });
    expect(busy).toBeDisabled();
    await fireEvent.press(busy);
    expect(deleteTrip).toHaveBeenCalledTimes(1);
    expect(onDeleted).not.toHaveBeenCalled();
    resolve({ ok: true, value: undefined });
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });

  it('keeps the Trip visible after failure and allows retry', async () => {
    const deleteTrip = jest.fn<ReturnType<TripDeletionPort['deleteTrip']>, Parameters<TripDeletionPort['deleteTrip']>>()
      .mockResolvedValueOnce({ ok: false, error: { kind: 'unavailable' } })
      .mockResolvedValueOnce({ ok: true, value: undefined });
    const onDeleted = jest.fn();
    await render(<TripDetailScreen {...screenProps({ deleteTrip }, onDeleted)} />);
    await fireEvent.press(await screen.findByRole('button', { name: '删除旅行' }));
    await fireEvent.press(screen.getByRole('button', { name: '确认删除' }));
    expect(await screen.findByText('删除未完成，请重试')).toBeTruthy();
    expect(screen.getByText('东京')).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: '重试删除' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleteTrip).toHaveBeenCalledTimes(2);
  });
});
