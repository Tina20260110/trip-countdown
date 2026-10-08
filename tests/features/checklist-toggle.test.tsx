import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { ChecklistRepository } from '../../src/contracts/repositories';
import type { ChecklistItem } from '../../src/domain/types';
import { ChecklistSection } from '../../src/features/checklist/ChecklistSection';

const pending: ChecklistItem = { id: 1, tripId: 7, title: '护照', completed: false, createdAt: 1 };
const completed: ChecklistItem = { ...pending, completed: true };

function repo(overrides: Partial<ChecklistRepository>): ChecklistRepository {
  return { list: jest.fn(), add: jest.fn(), setCompleted: jest.fn(), remove: jest.fn(), ...overrides };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe('Checklist completed state', () => {
  it.each([
    [pending, true, completed, '已完成'],
    [completed, false, pending, '待完成'],
  ] as const)('persists an explicit target and re-reads %s', async (initial, target, saved, statusText) => {
    const list = jest.fn()
      .mockResolvedValueOnce({ ok: true, value: [initial] })
      .mockResolvedValueOnce({ ok: true, value: [saved] });
    const setCompleted = jest.fn().mockResolvedValue({ ok: true, value: saved });
    await render(<ChecklistSection tripId={7} repository={repo({ list, setCompleted })} />);
    const checkbox = await screen.findByRole('checkbox', { name: `护照，${initial.completed ? '已完成' : '待完成'}` });
    expect(checkbox.props.accessibilityState).toMatchObject({ checked: initial.completed, disabled: false });
    await fireEvent.press(checkbox);

    await waitFor(() => expect(setCompleted).toHaveBeenCalledWith(1, target));
    expect(await screen.findByText(statusText)).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('disables the checkbox and prevents repeated writes while saving', async () => {
    const update = deferred<Awaited<ReturnType<ChecklistRepository['setCompleted']>>>();
    const list = jest.fn()
      .mockResolvedValueOnce({ ok: true, value: [pending] })
      .mockResolvedValueOnce({ ok: true, value: [completed] });
    const setCompleted = jest.fn().mockReturnValue(update.promise);
    await render(<ChecklistSection tripId={7} repository={repo({ list, setCompleted })} />);
    const checkbox = await screen.findByRole('checkbox', { name: '护照，待完成' });
    await fireEvent.press(checkbox);
    const busy = await screen.findByRole('checkbox', { name: '护照，正在保存' });
    expect(busy.props.accessibilityState).toMatchObject({ checked: false, disabled: true, busy: true });
    await fireEvent.press(busy);
    expect(setCompleted).toHaveBeenCalledTimes(1);
    update.resolve({ ok: true, value: completed });
    expect(await screen.findByText('已完成')).toBeTruthy();
  });

  it('keeps the last successful state after failure and supports retry', async () => {
    const list = jest.fn()
      .mockResolvedValueOnce({ ok: true, value: [pending] })
      .mockResolvedValueOnce({ ok: true, value: [completed] });
    const setCompleted = jest.fn()
      .mockResolvedValueOnce({ ok: false, error: { kind: 'storage', message: 'SQL /private 护照' } })
      .mockResolvedValueOnce({ ok: true, value: completed });
    await render(<ChecklistSection tripId={7} repository={repo({ list, setCompleted })} />);
    await fireEvent.press(await screen.findByRole('checkbox', { name: '护照，待完成' }));

    expect(await screen.findByText('更新事项失败，请重试')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: '护照，待完成' }).props.accessibilityState.checked).toBe(false);
    expect(screen.queryByText(/SQL|\/private/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '重试更新状态' }));
    expect(await screen.findByRole('checkbox', { name: '护照，已完成' })).toBeTruthy();
    expect(setCompleted).toHaveBeenCalledTimes(2);
  });

  it('does not let an old Trip mutation overwrite the new Trip', async () => {
    const update = deferred<Awaited<ReturnType<ChecklistRepository['setCompleted']>>>();
    const list = jest.fn()
      .mockResolvedValueOnce({ ok: true, value: [pending] })
      .mockResolvedValueOnce({ ok: true, value: [{ ...pending, id: 2, tripId: 8, title: '签证' }] });
    const setCompleted = jest.fn().mockReturnValue(update.promise);
    const repository = repo({ list, setCompleted });
    const view = await render(<ChecklistSection tripId={7} repository={repository} />);
    await fireEvent.press(await screen.findByRole('checkbox', { name: '护照，待完成' }));
    await view.rerender(<ChecklistSection tripId={8} repository={repository} />);
    expect(await screen.findByRole('checkbox', { name: '签证，待完成' })).toBeTruthy();
    update.resolve({ ok: true, value: completed });
    await waitFor(() => expect(screen.queryByText('护照')).toBeNull());
  });
});
