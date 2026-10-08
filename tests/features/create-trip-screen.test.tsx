import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { TripRepository } from '../../src/contracts/repositories';
import type { Trip } from '../../src/domain/types';
import { CreateTripScreen } from '../../src/features/trips/CreateTripScreen';

function repositoryWithCreate(create: TripRepository['create']): TripRepository {
  return {
    list: jest.fn(),
    get: jest.fn(),
    create,
    update: jest.fn(),
    delete: jest.fn(),
  };
}

const savedTrip: Trip = {
  id: 1,
  destination: '东京',
  departureDate: '2026-10-22',
  notes: '',
  createdAt: 1,
  updatedAt: 1,
};

async function fillForm() {
  await fireEvent.changeText(screen.getByLabelText('目的地'), '  东京  ');
  await fireEvent.changeText(screen.getByLabelText('出发日期'), '2026-10-22');
  await fireEvent.changeText(screen.getByLabelText('备注'), '准备护照');
}

describe('CreateTripScreen', () => {
  it('shows Chinese fields and keeps invalid input without calling the repository', async () => {
    const create = jest.fn<ReturnType<TripRepository['create']>, Parameters<TripRepository['create']>>();
    await render(
      <CreateTripScreen
        repository={repositoryWithCreate(create)}
        getNow={() => new Date(2026, 9, 8, 12)}
        onCreated={jest.fn()}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText('目的地'), '   ');
    await fireEvent.changeText(screen.getByLabelText('出发日期'), '2026-10-07');
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));

    expect(await screen.findByText('请输入目的地')).toBeTruthy();
    expect(screen.getByText('出发日期不能早于今天')).toBeTruthy();
    expect(screen.getByLabelText('目的地').props.value).toBe('   ');
    expect(create).not.toHaveBeenCalled();
  });

  it('re-reads local today at save time and navigates only after commit succeeds', async () => {
    const create = jest.fn<ReturnType<TripRepository['create']>, Parameters<TripRepository['create']>>().mockResolvedValue({ ok: true, value: savedTrip });
    const onCreated = jest.fn();
    let now = new Date(2026, 9, 7, 23, 59);
    await render(
      <CreateTripScreen repository={repositoryWithCreate(create)} getNow={() => now} onCreated={onCreated} />,
    );
    await fillForm();
    now = new Date(2026, 9, 8, 0, 1);
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({
      destination: '东京', departureDate: '2026-10-22', notes: '准备护照',
    }, '2026-10-08'));
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('shows a safe save error, preserves input, and supports retry', async () => {
    const create = jest
      .fn<ReturnType<TripRepository['create']>, Parameters<TripRepository['create']>>()
      .mockResolvedValueOnce({ ok: false, error: { kind: 'storage', message: 'SQL /private Tokyo' } })
      .mockResolvedValueOnce({ ok: true, value: savedTrip });
    const onCreated = jest.fn();
    await render(
      <CreateTripScreen
        repository={repositoryWithCreate(create)}
        getNow={() => new Date(2026, 9, 8, 12)}
        onCreated={onCreated}
      />,
    );
    await fillForm();
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));

    expect(await screen.findByText('保存失败，请重试')).toBeTruthy();
    expect(screen.queryByText(/SQL|\/private/)).toBeNull();
    expect(screen.getByLabelText('目的地').props.value).toBe('  东京  ');
    expect(onCreated).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: '保存旅行' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  it('prevents duplicate submission while saving', async () => {
    let resolve!: (value: { ok: true; value: Trip }) => void;
    const pending = new Promise<{ ok: true; value: Trip }>((next) => { resolve = next; });
    const create = jest.fn<ReturnType<TripRepository['create']>, Parameters<TripRepository['create']>>().mockReturnValue(pending);
    await render(
      <CreateTripScreen
        repository={repositoryWithCreate(create)}
        getNow={() => new Date(2026, 9, 8, 12)}
        onCreated={jest.fn()}
      />,
    );
    await fillForm();
    const save = screen.getByRole('button', { name: '保存旅行' });
    await fireEvent.press(save);
    expect(await screen.findByRole('button', { name: '正在保存' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: '正在保存' }));
    expect(create).toHaveBeenCalledTimes(1);
    resolve({ ok: true, value: savedTrip });
    await waitFor(() => expect(screen.getByRole('button', { name: '保存旅行' })).toBeEnabled());
  });
});
