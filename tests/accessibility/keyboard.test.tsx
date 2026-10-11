import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { ChecklistRepository, TripRepository } from '../../src/contracts/repositories';
import { ChecklistSection } from '../../src/features/checklist/ChecklistSection';
import { CreateTripScreen } from '../../src/features/trips/CreateTripScreen';
import { TripDetailScreen } from '../../src/features/trips/TripDetailScreen';
import type { TripDeletionPort } from '../../src/features/trips/trip-deletion-port';
import { detail, emptyChecklistRepository, repositoryWithGet } from '../features/trip-fixtures';

function tripRepository(create: TripRepository['create']): TripRepository {
  return {
    list: jest.fn(),
    get: jest.fn(),
    create,
    update: jest.fn(),
    delete: jest.fn(),
  };
}

describe('external keyboard interaction contract', () => {
  it('moves through the Trip fields in source order and activates the Save button', async () => {
    const create = jest.fn().mockResolvedValue({
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
    const created = jest.fn();
    await render(
      <CreateTripScreen
        repository={tripRepository(create)}
        getNow={() => new Date(2026, 9, 10)}
        onCreated={created}
      />,
    );
    const destination = screen.getByLabelText('目的地');
    const departureDate = screen.getByLabelText('出发日期');
    const notes = screen.getByLabelText('备注');
    expect(destination.props.returnKeyType).toBe('next');
    expect(departureDate.props.returnKeyType).toBe('next');
    expect(notes.props.submitBehavior).toBe('newline');

    await fireEvent.changeText(destination, '东京');
    await fireEvent.changeText(departureDate, '2026-10-20');
    await fireEvent(destination, 'submitEditing', { nativeEvent: { text: '东京' } });
    expect(departureDate).toHaveProp('accessibilityLabel', '出发日期');
    await fireEvent(departureDate, 'submitEditing', { nativeEvent: { text: '2026-10-20' } });
    expect(notes).toHaveProp('accessibilityLabel', '备注');
    const save = screen.getByRole('button', { name: '保存旅行' });
    expect(save.props.focusable).toBe(true);
    await fireEvent.press(save);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('adds a valid Checklist item from the input submit action', async () => {
    const values: { id: number; tripId: number; title: string; completed: false; createdAt: number }[] = [];
    const repository: ChecklistRepository = {
      list: jest.fn(async () => ({ ok: true as const, value: [...values] })),
      add: jest.fn(async (tripId, input) => {
        const value = { id: 1, tripId, title: input.title, completed: false as const, createdAt: 1 };
        values.push(value);
        return { ok: true as const, value };
      }),
      setCompleted: jest.fn(),
      remove: jest.fn(),
    };
    await render(<ChecklistSection tripId={1} repository={repository} />);
    const input = await screen.findByLabelText('事项名称');
    expect(input.props.returnKeyType).toBe('done');
    expect(input.props.submitBehavior).toBe('submit');
    await fireEvent.changeText(input, '护照');
    await fireEvent(input, 'submitEditing', { nativeEvent: { text: '护照' } });
    expect(await screen.findByRole('checkbox', { name: '护照，待完成' })).toBeTruthy();
    expect(repository.add).toHaveBeenCalledTimes(1);
  });

  it('keeps delete confirmation cancel and confirm as named keyboard-activatable buttons', async () => {
    const deleteTrip = jest.fn<ReturnType<TripDeletionPort['deleteTrip']>, Parameters<TripDeletionPort['deleteTrip']>>()
      .mockResolvedValue({ ok: true, value: undefined });
    const onDeleted = jest.fn();
    await render(
      <TripDetailScreen
        tripId="7"
        repository={repositoryWithGet(jest.fn().mockResolvedValue({ ok: true, value: detail() }))}
        checklistRepository={emptyChecklistRepository()}
        deletionPort={{ deleteTrip }}
        getNow={() => new Date(2026, 9, 10)}
        onBack={jest.fn()}
        onEdit={jest.fn()}
        onDeleted={onDeleted}
      />,
    );
    await fireEvent.press(await screen.findByRole('button', { name: '删除旅行' }));
    const cancel = screen.getByRole('button', { name: '取消删除' });
    expect(cancel.props.focusable).toBe(true);
    await fireEvent.press(cancel);
    expect(deleteTrip).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: '删除旅行' }));
    const confirm = screen.getByRole('button', { name: '确认删除' });
    expect(confirm.props.focusable).toBe(true);
    await fireEvent.press(confirm);
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });
});
