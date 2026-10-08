import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  ActionButton,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../src/components/AsyncState';
import { FormField } from '../../src/components/FormField';

describe('shared async states', () => {
  it('renders distinct Chinese Loading and Empty states', async () => {
    const loading = await render(<LoadingState />);
    expect(loading.getByText('正在加载')).toBeTruthy();
    expect(loading.getByRole('progressbar')).toBeTruthy();
    await loading.unmount();

    await render(<EmptyState message="还没有旅行" />);
    expect(screen.getByText('还没有旅行')).toBeTruthy();
    expect(screen.queryByText('正在加载')).toBeNull();
  });

  it('renders an accessible Error with Retry and calls its callback', async () => {
    const retry = jest.fn();
    await render(<ErrorState message="读取失败，请重试" onRetry={retry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('读取失败，请重试');
    const button = screen.getByRole('button', { name: '重试' });
    fireEvent.press(button);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('exposes busy and disabled state and prevents duplicate actions', async () => {
    const press = jest.fn();
    const { rerender } = await render(
      <ActionButton label="保存" onPress={press} busy />,
    );
    const busy = screen.getByRole('button', { name: '正在保存' });
    expect(busy).toBeDisabled();
    expect(busy.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    fireEvent.press(busy);
    expect(press).not.toHaveBeenCalled();

    await rerender(<ActionButton label="保存" onPress={press} disabled />);
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  });

  it('keeps long text scalable and wrapping without line limits', async () => {
    const message = '这是一段用于验证系统字体缩放和长中文文案换行能力的错误说明。';
    await render(<ErrorState message={message} />);
    const text = screen.getByText(message);

    expect(text.props.allowFontScaling).not.toBe(false);
    expect(text.props.numberOfLines).toBeUndefined();
  });
});

describe('FormField', () => {
  it('associates an accessible label and perceptible validation error', async () => {
    const change = jest.fn();
    await render(
      <FormField
        label="目的地"
        value=""
        onChangeText={change}
        error="请输入目的地"
      />,
    );

    const input = screen.getByLabelText('目的地');
    fireEvent.changeText(input, '东京');
    expect(change).toHaveBeenCalledWith('东京');
    expect(input.props.accessibilityHint).toContain('请输入目的地');
    expect(screen.getByRole('alert')).toHaveTextContent('请输入目的地');
  });

  it('exposes disabled state without suppressing font scaling', async () => {
    await render(
      <FormField label="备注" value="内容" onChangeText={jest.fn()} disabled />,
    );
    const input = screen.getByLabelText('备注');
    expect(input).toBeDisabled();
    expect(input.props.allowFontScaling).not.toBe(false);
  });
});
