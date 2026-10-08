import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { TripRepository } from '../../src/contracts/repositories';
import { TripDetailScreen } from '../../src/features/trips/TripDetailScreen';
import { detail, emptyChecklistRepository, repositoryWithGet } from './trip-fixtures';

describe('TripDetailScreen', () => {
  it('shows loading and then the persisted Trip fields and actions', async () => {
    let resolve!: (value: Awaited<ReturnType<TripRepository['get']>>) => void;
    const get = jest.fn<ReturnType<TripRepository['get']>, Parameters<TripRepository['get']>>()
      .mockReturnValue(new Promise((next) => { resolve = next; }));
    await render(
      <TripDetailScreen
        tripId="7"
        repository={repositoryWithGet(get)}
        checklistRepository={emptyChecklistRepository()}
        getNow={() => new Date(2026, 9, 8, 12)}
        onBack={jest.fn()}
        onEdit={jest.fn()}
        onDeleted={jest.fn()}
      />,
    );
    expect(screen.getByText('正在加载旅行')).toBeTruthy();
    resolve({ ok: true, value: detail() });
    expect(await screen.findByText('东京')).toBeTruthy();
    expect(screen.getByText('2026-10-22')).toBeTruthy();
    expect(screen.getByText('准备护照')).toBeTruthy();
    expect(screen.getByText('还有 14 天')).toBeTruthy();
    expect(screen.getByRole('button', { name: '编辑旅行' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '删除旅行' })).toBeTruthy();
  });

  it.each([
    ['2026-10-08', '今天出发'],
    ['2026-10-01', '旅行已结束'],
  ])('shows the countdown for %s as %s', async (departureDate, label) => {
    const get = jest.fn<ReturnType<TripRepository['get']>, Parameters<TripRepository['get']>>()
      .mockResolvedValue({ ok: true, value: detail({ departureDate, notes: '' }) });
    await render(
      <TripDetailScreen
        tripId="7"
        repository={repositoryWithGet(get)}
        checklistRepository={emptyChecklistRepository()}
        getNow={() => new Date(2026, 9, 8, 12)}
        onBack={jest.fn()}
        onEdit={jest.fn()}
        onDeleted={jest.fn()}
      />,
    );
    expect(await screen.findByText(label)).toBeTruthy();
    expect(screen.getByText('没有备注')).toBeTruthy();
  });

  it('distinguishes invalid/not-found from a storage error and supports retry', async () => {
    const invalidGet = jest.fn<ReturnType<TripRepository['get']>, Parameters<TripRepository['get']>>();
    const invalidView = await render(
      <TripDetailScreen
        tripId="abc"
        repository={repositoryWithGet(invalidGet)}
        checklistRepository={emptyChecklistRepository()}
        getNow={() => new Date(2026, 9, 8)}
        onBack={jest.fn()}
        onEdit={jest.fn()}
        onDeleted={jest.fn()}
      />,
    );
    expect(screen.getByText('旅行不存在')).toBeTruthy();
    expect(screen.getByRole('button', { name: '返回旅行列表' })).toBeTruthy();
    expect(invalidGet).not.toHaveBeenCalled();
    await invalidView.unmount();

    const get = jest.fn<ReturnType<TripRepository['get']>, Parameters<TripRepository['get']>>()
      .mockResolvedValueOnce({ ok: false, error: { kind: 'storage', message: 'SQL /private Tokyo' } })
      .mockResolvedValueOnce({ ok: false, error: { kind: 'not-found', message: 'missing' } });
    await render(
      <TripDetailScreen
        tripId="7"
        repository={repositoryWithGet(get)}
        checklistRepository={emptyChecklistRepository()}
        getNow={() => new Date(2026, 9, 8)}
        onBack={jest.fn()}
        onEdit={jest.fn()}
        onDeleted={jest.fn()}
      />,
    );
    expect(await screen.findByText('读取旅行失败，请重试')).toBeTruthy();
    expect(screen.queryByText(/SQL|\/private|Tokyo/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('旅行不存在')).toBeTruthy();
  });

  it('calls Edit and reloads persisted data when focus changes', async () => {
    const get = jest.fn<ReturnType<TripRepository['get']>, Parameters<TripRepository['get']>>()
      .mockResolvedValueOnce({ ok: true, value: detail() })
      .mockResolvedValueOnce({ ok: true, value: detail({ destination: '大阪' }) });
    const onEdit = jest.fn();
    const props = {
      tripId: '7', repository: repositoryWithGet(get), checklistRepository: emptyChecklistRepository(), getNow: () => new Date(2026, 9, 8),
      onBack: jest.fn(), onEdit, onDeleted: jest.fn(),
    };
    const view = await render(<TripDetailScreen {...props} focusSignal={0} />);
    await fireEvent.press(await screen.findByRole('button', { name: '编辑旅行' }));
    expect(onEdit).toHaveBeenCalledWith(7);
    await view.rerender(<TripDetailScreen {...props} focusSignal={1} />);
    expect(await screen.findByText('大阪')).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(2);
  });
});
