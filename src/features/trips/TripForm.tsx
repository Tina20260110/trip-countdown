import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { ActionButton } from '../../components/AsyncState';
import { FormField } from '../../components/FormField';
import type { SafeUiMessage } from '../../components/ui-messages';
import type { TripInput, ValidationError } from '../../domain/types';

interface TripFormProps {
  value: TripInput;
  errors?: ValidationError['fieldErrors'];
  busy?: boolean;
  submitError?: SafeUiMessage;
  onChange: (value: TripInput) => void;
  onSubmit: () => void;
}

export function TripForm({ value, errors = {}, busy = false, submitError, onChange, onSubmit }: TripFormProps) {
  const departureDateRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FormField
        label="目的地"
        value={value.destination}
        onChangeText={(destination) => onChange({ ...value, destination })}
        error={errors.destination}
        disabled={busy}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => departureDateRef.current?.focus()}
      />
      <FormField
        label="出发日期"
        placeholder="YYYY-MM-DD"
        value={value.departureDate}
        onChangeText={(departureDate) => onChange({ ...value, departureDate })}
        error={errors.departureDate}
        disabled={busy}
        inputRef={departureDateRef}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => notesRef.current?.focus()}
      />
      <FormField
        label="备注"
        value={value.notes}
        onChangeText={(notes) => onChange({ ...value, notes })}
        error={errors.notes}
        disabled={busy}
        multiline
        inputRef={notesRef}
        submitBehavior="newline"
      />
      {submitError ? (
        <Text accessibilityRole="alert" style={styles.error}>{submitError}</Text>
      ) : null}
      <ActionButton label="保存旅行" busyLabel="正在保存" busy={busy} onPress={onSubmit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, backgroundColor: '#FFFFFF', flexGrow: 1 },
  error: { color: '#8A1C1C', fontSize: 14, lineHeight: 20 },
});
