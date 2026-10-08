import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { ChecklistRepository } from '../../src/contracts/repositories';
import type { ChecklistItem } from '../../src/domain/types';
import { ChecklistSection } from '../../src/features/checklist/ChecklistSection';

function item(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 1,
    tripId: 7,
    title: '护照',
    completed: false,
    createdAt: 1,
    ...overrides,
  };
}

function repository(overrides: Partial<ChecklistRepository> = {}): ChecklistRepository {
  return {
    list: jest.fn().mockResolvedValue({ ok: true, value: [] }),
    add: jest.fn(),
    setCompleted: jest.fn(),
    remove: jest.fn(),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe('ChecklistSection add flow', () => {
  it('distinguishes loading, empty, read error, and retry', async () => {
    const pending = deferred<Awaited<ReturnType<ChecklistRepository['list']>>>();
    const list = jest
      .fn<ReturnType<ChecklistRepository['list']>, Parameters<ChecklistRepository['list']>>()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ ok: false, error: { kind: 'storage', message: 'SQL /private 护照' } })
      .mockResolvedValueOnce({ ok: true, value: [] });

    await render(<ChecklistSection tripId={7} repository={repository({ list })} />);
    expect(screen.getByText('正在加载准备事项')).toBeTruthy();
    expect(screen.queryByText('还没有准备事项')).toBeNull();

    pending.resolve({ ok: false, error: { kind: 'storage', message: 'SQL /private 护照' } });
    expect(await screen.findByText('读取准备事项失败，请重试')).toBeTruthy();
    expect(screen.queryByText(/SQL|\/private/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('读取准备事项失败，请重试')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('还没有准备事项')).toBeTruthy();
    expect(screen.getByLabelText('事项名称')).toBeTruthy();
  });

  it('reads and renders only the current Trip checklist in stable repository order', async () => {
    const list = jest.fn().mockResolvedValue({
      ok: true,
      value: [item(), item({ id: 2, title: '签证' })],
    });
    await render(<ChecklistSection tripId={7} repository={repository({ list })} />);

    expect(await screen.findByText('护照')).toBeTruthy();
    expect(screen.getByText('签证')).toBeTruthy();
    expect(list).toHaveBeenCalledWith(7);
  });

  it('trims a valid title, adds it, then re-reads repository state', async () => {
    const saved = item({ title: '充电器' });
    const list = jest
      .fn<ReturnType<ChecklistRepository['list']>, Parameters<ChecklistRepository['list']>>()
      .mockResolvedValueOnce({ ok: true, value: [] })
      .mockResolvedValueOnce({ ok: true, value: [saved] });
    const add = jest.fn().mockResolvedValue({ ok: true, value: saved });
    await render(<ChecklistSection tripId={7} repository={repository({ list, add })} />);
    await screen.findByText('还没有准备事项');

    await fireEvent.changeText(screen.getByLabelText('事项名称'), '  充电器  ');
    await fireEvent.press(screen.getByRole('button', { name: '添加事项' }));

    await waitFor(() => expect(add).toHaveBeenCalledWith(7, { title: '充电器' }));
    expect(await screen.findByText('充电器')).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('事项名称').props.value).toBe('');
  });

  it.each([
    ['   ', '请输入事项名称'],
    [`${'旅'.repeat(100)}程`, '事项名称最多 100 个字符'],
  ])('rejects invalid title %p without calling add', async (title, message) => {
    const add = jest.fn();
    await render(<ChecklistSection tripId={7} repository={repository({ add })} />);
    await screen.findByText('还没有准备事项');
    await fireEvent.changeText(screen.getByLabelText('事项名称'), title);
    await fireEvent.press(screen.getByRole('button', { name: '添加事项' }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(add).not.toHaveBeenCalled();
    expect(screen.getByLabelText('事项名称').props.value).toBe(title);
  });

  it.each([
    ['证', '证'],
    ['👨‍👩‍👧‍👦'.repeat(100), '👨‍👩‍👧‍👦'.repeat(100)],
  ])('accepts the 1/100 grapheme boundary', async (title, expected) => {
    const saved = item({ title: expected });
    const list = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, value: [] })
      .mockResolvedValueOnce({ ok: true, value: [saved] });
    const add = jest.fn().mockResolvedValue({ ok: true, value: saved });
    await render(<ChecklistSection tripId={7} repository={repository({ list, add })} />);
    await screen.findByText('还没有准备事项');
    await fireEvent.changeText(screen.getByLabelText('事项名称'), title);
    await fireEvent.press(screen.getByRole('button', { name: '添加事项' }));

    await waitFor(() => expect(add).toHaveBeenCalledWith(7, { title: expected }));
  });

  it('uses a synchronous guard to prevent duplicate adds while saving', async () => {
    const pending = deferred<Awaited<ReturnType<ChecklistRepository['add']>>>();
    const add = jest.fn().mockReturnValue(pending.promise);
    const list = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, value: [] })
      .mockResolvedValueOnce({ ok: true, value: [item()] });
    await render(<ChecklistSection tripId={7} repository={repository({ list, add })} />);
    await screen.findByText('还没有准备事项');
    await fireEvent.changeText(screen.getByLabelText('事项名称'), '护照');
    const button = screen.getByRole('button', { name: '添加事项' });
    await fireEvent.press(button);
    await fireEvent.press(button);

    expect(add).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: '正在添加' })).toBeDisabled();
    pending.resolve({ ok: true, value: item() });
    expect(await screen.findByText('护照')).toBeTruthy();
  });

  it('keeps the original input and shows no fake item when add fails', async () => {
    const add = jest.fn().mockResolvedValue({
      ok: false,
      error: { kind: 'storage', message: 'INSERT 护照 /private/path' },
    });
    const list = jest.fn().mockResolvedValue({ ok: true, value: [] });
    await render(<ChecklistSection tripId={7} repository={repository({ list, add })} />);
    await screen.findByText('还没有准备事项');
    await fireEvent.changeText(screen.getByLabelText('事项名称'), '  护照  ');
    await fireEvent.press(screen.getByRole('button', { name: '添加事项' }));

    expect(await screen.findByText('添加事项失败，请重试')).toBeTruthy();
    expect(screen.getByLabelText('事项名称').props.value).toBe('  护照  ');
    expect(screen.queryByText(/^护照$/)).toBeNull();
    expect(screen.queryByText(/INSERT|\/private/)).toBeNull();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('reports refresh failure accurately after a committed add and retries only the read', async () => {
    const saved = item();
    const list = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, value: [] })
      .mockResolvedValueOnce({ ok: false, error: { kind: 'storage', message: 'read failed' } })
      .mockResolvedValueOnce({ ok: true, value: [saved] });
    const add = jest.fn().mockResolvedValue({ ok: true, value: saved });
    await render(<ChecklistSection tripId={7} repository={repository({ list, add })} />);
    await screen.findByText('还没有准备事项');
    await fireEvent.changeText(screen.getByLabelText('事项名称'), '护照');
    await fireEvent.press(screen.getByRole('button', { name: '添加事项' }));

    expect(await screen.findByText('事项已保存，但列表刷新失败，请重试')).toBeTruthy();
    expect(screen.queryByText('添加事项失败，请重试')).toBeNull();
    expect(screen.getByLabelText('事项名称').props.value).toBe('');
    await fireEvent.press(screen.getByRole('button', { name: '重新读取' }));
    expect(await screen.findByText('护照')).toBeTruthy();
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('isolates Trip changes and ignores a stale response from the previous Trip', async () => {
    const tripA = deferred<Awaited<ReturnType<ChecklistRepository['list']>>>();
    const list = jest
      .fn<ReturnType<ChecklistRepository['list']>, Parameters<ChecklistRepository['list']>>()
      .mockReturnValueOnce(tripA.promise)
      .mockResolvedValueOnce({ ok: true, value: [item({ id: 2, tripId: 8, title: '签证' })] })
      .mockResolvedValueOnce({ ok: true, value: [item({ id: 3, tripId: 8, title: '充电器' })] });
    const add = jest.fn().mockResolvedValue({
      ok: true,
      value: item({ id: 3, tripId: 8, title: '充电器' }),
    });
    const repo = repository({ list, add });
    const view = await render(<ChecklistSection tripId={7} repository={repo} />);
    await view.rerender(<ChecklistSection tripId={8} repository={repo} />);

    expect(await screen.findByText('签证')).toBeTruthy();
    tripA.resolve({ ok: true, value: [item({ title: '护照' })] });
    await waitFor(() => expect(screen.queryByText('护照')).toBeNull());
    await fireEvent.changeText(screen.getByLabelText('事项名称'), '充电器');
    await fireEvent.press(screen.getByRole('button', { name: '添加事项' }));
    expect(await screen.findByText('充电器')).toBeTruthy();
    expect(add).toHaveBeenCalledWith(8, { title: '充电器' });
    expect(list).toHaveBeenNthCalledWith(1, 7);
    expect(list).toHaveBeenNthCalledWith(2, 8);
    expect(list).toHaveBeenNthCalledWith(3, 8);
  });

  it('re-reads repository data on remount instead of retaining a duplicate source', async () => {
    const list = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, value: [item()] })
      .mockResolvedValueOnce({ ok: true, value: [item({ id: 2, title: '签证' })] });
    const repo = repository({ list });
    const first = await render(<ChecklistSection tripId={7} repository={repo} />);
    expect(await screen.findByText('护照')).toBeTruthy();
    await first.unmount();
    await render(<ChecklistSection tripId={7} repository={repo} />);

    expect(await screen.findByText('签证')).toBeTruthy();
    expect(screen.queryByText('护照')).toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
  });
});
