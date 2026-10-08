import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/AsyncState';
import type { ChecklistItem } from '../../domain/types';

interface ChecklistItemRowProps {
  item: ChecklistItem;
  toggleBusy: boolean;
  deleteBusy: boolean;
  disabled: boolean;
  onSetCompleted: (completed: boolean) => void;
  onDelete: () => void;
}

export function ChecklistItemRow({ item, toggleBusy, deleteBusy, disabled, onSetCompleted, onDelete }: ChecklistItemRowProps) {
  const status = toggleBusy ? '正在保存' : item.completed ? '已完成' : '待完成';
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={`${item.title}，${status}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.completed, disabled, busy: toggleBusy }}
        disabled={disabled}
        onPress={() => onSetCompleted(!item.completed)}
        style={({ pressed }) => [styles.checkbox, pressed && !disabled && styles.pressed]}>
        <Text style={styles.mark}>{item.completed ? '✓' : '○'}</Text>
        <View style={styles.text}>
          <Text style={[styles.title, item.completed && styles.completed]}>{item.title}</Text>
          <Text style={styles.status}>{status}</Text>
        </View>
      </Pressable>
      <ActionButton
        label={`删除${item.title}`}
        busyLabel={`正在删除${item.title}`}
        busy={deleteBusy}
        disabled={disabled && !deleteBusy}
        onPress={onDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, padding: 12, borderWidth: 1, borderColor: '#C5CBD1', borderRadius: 8 },
  checkbox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.7 },
  mark: { fontSize: 22, lineHeight: 28, color: '#174D78' },
  text: { flex: 1 },
  title: { fontSize: 16, lineHeight: 24, color: '#111111', flexShrink: 1 },
  completed: { textDecorationLine: 'line-through' },
  status: { fontSize: 14, lineHeight: 20, color: '#4A545E' },
});
