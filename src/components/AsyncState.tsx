import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface MessageStateProps {
  message: string;
}

export function LoadingState({ message = '正在加载' }: Partial<MessageStateProps>) {
  return (
    <View accessible style={styles.stateContainer} accessibilityRole="progressbar">
      <ActivityIndicator accessibilityElementsHidden />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

export function EmptyState({ message }: MessageStateProps) {
  return (
    <View style={styles.stateContainer}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

interface ErrorStateProps extends MessageStateProps {
  onRetry?: () => void;
  retryBusy?: boolean;
  retryLabel?: string;
}

export function ErrorState({ message, onRetry, retryBusy = false, retryLabel = '重试' }: ErrorStateProps) {
  return (
    <View style={styles.stateContainer}>
      <Text accessibilityRole="alert" style={[styles.message, styles.errorText]}>
        {message}
      </Text>
      {onRetry ? (
        <ActionButton
          label={retryLabel}
          busyLabel="正在重试"
          busy={retryBusy}
          onPress={onRetry}
        />
      ) : null}
    </View>
  );
}

interface ActionButtonProps {
  label: string;
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children?: ReactNode;
}

export function ActionButton({
  label,
  busyLabel,
  busy = false,
  disabled = false,
  onPress,
}: ActionButtonProps) {
  const unavailable = busy || disabled;
  const visibleLabel = busy ? (busyLabel ?? `正在${label}`) : label;

  return (
    <Pressable
      accessibilityLabel={visibleLabel}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        unavailable && styles.buttonDisabled,
        pressed && !unavailable && styles.buttonPressed,
      ]}>
      <Text style={styles.buttonText}>{visibleLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    flexShrink: 1,
  },
  errorText: {
    color: '#8A1C1C',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1769AA',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
