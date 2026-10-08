import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { ChecklistRepository } from '../../src/contracts/repositories';
import type { ChecklistItem } from '../../src/domain/types';
import { ChecklistSection } from '../../src/features/checklist/ChecklistSection';

const passport: ChecklistItem = { id: 1, tripId: 7, title: '护照', completed: true, createdAt: 1 };
const visa: ChecklistItem = { id: 2, tripId: 7, title: '签证', completed: false, createdAt: 2 };

function repo(overrides: Partial<ChecklistRepository>): ChecklistRepository {
  return { list: jest.fn(), add: jest.fn(), setCompleted: jest.fn(), remove: jest.fn(), ...overrides };
}

describe('Checklist delete and progress', () => {
  it('deletes, re-reads, and derives progress with the Domain function', async () => {
    const list = jest.fn()
      .mockResolvedValueOnce({ ok: true, value: [passport, visa] })
      .mockResolvedValueOnce({ ok: true, value: [visa] });
    const remove = jest.fn().mockResolvedValue({ ok: true, value: undefined });
    await render(<ChecklistSection tripId={7} repository={repo({ list, remove })} />);
    expect(await screen.findByText('已完成 1 / 2')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '删除护照' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith(1));
    expect(await screen.findByText('已完成 0 / 1')).toBeTruthy();
    expect(screen.queryByText('护照')).toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('returns to Empty and hides progress after deleting the final item', async () => {
    const list = jest.fn()
      .mockResolvedValueOnce({ ok: true, value: [passport] })
      .mockResolvedValueOnce({ ok: true, value: [] });
    const remove = jest.fn().mockResolvedValue({ ok: true, value: undefined });
    await render(<ChecklistSection tripId={7} repository={repo({ list, remove })} />);
    expect(await screen.findByText('已完成 1 / 1')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '删除护照' }));

    expect(await screen.findByText('还没有准备事项')).toBeTruthy();
    expect(screen.queryByText(/已完成 \d+ \/ \d+/)).toBeNull();
  });

  it('keeps the item on failure, prevents duplicates, and retries', async () => {
    let resolve!: (value: Awaited<ReturnType<ChecklistRepository['remove']>>) => void;
    const pending = new Promise<Awaited<ReturnType<ChecklistRepository['remove']>>>((next) => { resolve = next; });
    const list = jest.fn()
      .mockResolvedValueOnce({ ok: true, value: [passport] })
      .mockResolvedValueOnce({ ok: true, value: [] });
    const remove = jest.fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce({ ok: true, value: undefined });
    await render(<ChecklistSection tripId={7} repository={repo({ list, remove })} />);
    const button = await screen.findByRole('button', { name: '删除护照' });
    await fireEvent.press(button);
    const busy = await screen.findByRole('button', { name: '正在删除护照' });
    expect(busy).toBeDisabled();
    await fireEvent.press(busy);
    expect(remove).toHaveBeenCalledTimes(1);
    resolve({ ok: false, error: { kind: 'storage', message: 'DELETE /private 护照' } });
    expect(await screen.findByText('删除事项失败，请重试')).toBeTruthy();
    expect(screen.getByText('护照')).toBeTruthy();
    expect(screen.queryByText(/DELETE|\/private/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '重试删除事项' }));
    expect(await screen.findByText('还没有准备事项')).toBeTruthy();
  });

  it('does not retry a committed delete when only the refresh failed', async () => {
    const list = jest.fn()
      .mockResolvedValueOnce({ ok: true, value: [passport] })
      .mockResolvedValueOnce({ ok: false, error: { kind: 'storage', message: 'read' } })
      .mockResolvedValueOnce({ ok: true, value: [] });
    const remove = jest.fn().mockResolvedValue({ ok: true, value: undefined });
    await render(<ChecklistSection tripId={7} repository={repo({ list, remove })} />);
    await fireEvent.press(await screen.findByRole('button', { name: '删除护照' }));
    expect(await screen.findByText('事项已删除，但列表刷新失败，请重试')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '重新读取' }));
    expect(await screen.findByText('还没有准备事项')).toBeTruthy();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
