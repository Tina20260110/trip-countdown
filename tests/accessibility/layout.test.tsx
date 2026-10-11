import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ActionButton, ErrorState } from '../../src/components/AsyncState';
import { FormField } from '../../src/components/FormField';

describe('font scaling and touch layout contract', () => {
  it('keeps long button text within the available width and a 48dp target', async () => {
    const label = '这是一个需要在系统大字体下换行显示的长中文操作名称';
    await render(<ActionButton label={label} onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: label });
    const pressableStyle = StyleSheet.flatten(button.props.style);
    expect(pressableStyle.minHeight).toBeGreaterThanOrEqual(48);
    expect(pressableStyle.maxWidth).toBe('100%');
    expect(pressableStyle.alignSelf).toBe('stretch');
    const text = screen.getByText(label);
    expect(text.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(text.props.style).flexShrink).toBe(1);
  });

  it('does not disable system font scaling or truncate shared text and fields', async () => {
    await render(
      <>
        <ErrorState message="这是一段需要换行的中文错误信息，请检查后重试" />
        <FormField label="备注" value="很长的备注" multiline onChangeText={jest.fn()} />
      </>,
    );
    const message = screen.getByText('这是一段需要换行的中文错误信息，请检查后重试');
    expect(message.props.allowFontScaling).not.toBe(false);
    expect(message.props.numberOfLines).toBeUndefined();
    const input = screen.getByLabelText('备注');
    expect(input.props.allowFontScaling).not.toBe(false);
    expect(StyleSheet.flatten(input.props.style).minHeight).toBeGreaterThanOrEqual(48);
  });
});
