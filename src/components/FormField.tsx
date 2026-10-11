import { useId, type RefObject } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

interface FormFieldProps
  extends Pick<
    TextInputProps,
    | 'autoCapitalize'
    | 'keyboardType'
    | 'multiline'
    | 'onSubmitEditing'
    | 'placeholder'
    | 'returnKeyType'
    | 'submitBehavior'
  > {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  disabled?: boolean;
  inputRef?: RefObject<TextInput | null>;
}

export function FormField({
  label,
  value,
  onChangeText,
  error,
  disabled = false,
  inputRef,
  ...inputProps
}: FormFieldProps) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  return (
    <View style={styles.container}>
      <Text nativeID={fieldId} style={styles.label}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        accessibilityHint={error ? `输入有误：${error}` : undefined}
        accessibilityLabelledBy={fieldId}
        accessibilityState={{ disabled }}
        editable={!disabled}
        focusable={!disabled}
        onChangeText={onChangeText}
        style={[
          styles.input,
          inputProps.multiline && styles.multiline,
          error && styles.inputError,
          disabled && styles.disabled,
        ]}
        value={value}
        ref={inputRef}
      />
      {error ? (
        <Text nativeID={errorId} accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#5E6872',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111111',
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#A12424',
  },
  disabled: {
    opacity: 0.55,
  },
  error: {
    color: '#8A1C1C',
    fontSize: 14,
    lineHeight: 20,
  },
});
