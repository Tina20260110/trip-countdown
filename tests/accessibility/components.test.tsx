import { fireEvent, render, screen } from '@testing-library/react-native';

import { ActionButton, ErrorState } from '../../src/components/AsyncState';
import { FormField } from '../../src/components/FormField';
import type { ChecklistItem } from '../../src/domain/types';
import { ChecklistItemRow } from '../../src/features/checklist/ChecklistItemRow';

const item: ChecklistItem = {
  id: 1,
  tripId: 1,
  title: '护照',
  completed: true,
  createdAt: 1,
};

describe('shared accessibility contract', () => {
  it('exposes button names and busy/disabled state', async () => {
    await render(<ActionButton label="保存旅行" busyLabel="正在保存" busy onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: '正在保存' });
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('associates fields with labels and perceptible errors', async () => {
    await render(<FormField label="目的地" value="" error="请输入目的地" onChangeText={jest.fn()} />);
    expect(screen.getByLabelText('目的地').props.accessibilityHint).toBe('输入有误：请输入目的地');
    expect(screen.getByRole('alert')).toHaveTextContent('请输入目的地');
  });

  it('announces checklist role, checked state, text status and disabled state', async () => {
    const toggle = jest.fn();
    await render(
      <ChecklistItemRow
        item={item}
        toggleBusy={false}
        deleteBusy={false}
        disabled={false}
        onSetCompleted={toggle}
        onDelete={jest.fn()}
      />,
    );
    const checkbox = screen.getByRole('checkbox', { name: '护照，已完成' });
    expect(checkbox.props.accessibilityState).toMatchObject({ checked: true, disabled: false });
    expect(screen.getByText('已完成')).toBeTruthy();
    fireEvent.press(checkbox);
    expect(toggle).toHaveBeenCalledWith(false);
  });

  it('uses an alert role for safe errors and a named retry action', async () => {
    await render(<ErrorState message="读取失败，请重试" onRetry={jest.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('读取失败，请重试');
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
  });
});
