import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { ActionButton, ErrorState, LoadingState } from '../../components/AsyncState';
import { UI_MESSAGES } from '../../components/ui-messages';
import type { ReminderRepository } from '../../contracts/repositories';
import type { Reminder, ReminderOffset } from '../../domain/types';
import { useOptionalAppDependencies } from '../bootstrap/BootstrapGate';
import type { ReminderCoordinator } from './reminder-coordinator';

type State =
  | { status: 'loading' }
  | { status: 'error'; tripId: number }
  | { status: 'ready'; tripId: number; reminders: readonly Reminder[] };

interface ReminderSectionProps {
  tripId: number;
  departureDate: string;
  repository?: ReminderRepository;
  coordinator?: Pick<ReminderCoordinator, 'enable' | 'disable'>;
  platform?: 'ios' | 'android';
  refreshSignal?: number;
}

const OFFSETS: readonly ReminderOffset[] = [7, 1];

export function ReminderSection({
  tripId,
  departureDate,
  repository: repositoryOverride,
  coordinator: coordinatorOverride,
  platform = Platform.OS === 'android' ? 'android' : 'ios',
  refreshSignal = 0,
}: ReminderSectionProps) {
  const dependencies = useOptionalAppDependencies();
  const repository = repositoryOverride ?? dependencies?.reminderRepository;
  const coordinator = coordinatorOverride ?? dependencies?.reminderCoordinator;
  if (!repository || !coordinator) throw new Error('Reminder dependencies are unavailable before bootstrap is ready');

  const [state, setState] = useState<State>({ status: 'loading' });
  const [busyOffset, setBusyOffset] = useState<ReminderOffset | null>(null);
  const [operationError, setOperationError] = useState<ReminderOffset | null>(null);
  const sequence = useRef(0);
  const mutationGuard = useRef(false);

  const load = useCallback(async () => {
    const request = ++sequence.current;
    let result: Awaited<ReturnType<ReminderRepository['list']>>;
    try {
      result = await repository.list(tripId);
    } catch {
      if (request === sequence.current) setState({ status: 'error', tripId });
      return;
    }
    if (request !== sequence.current) return;
    setState(result.ok
      ? { status: 'ready', tripId, reminders: result.value }
      : { status: 'error', tripId });
  }, [repository, tripId]);

  useEffect(() => {
    void load();
    return () => { sequence.current += 1; };
  }, [load, refreshSignal]);

  const update = useCallback(async (offset: ReminderOffset, current?: Reminder) => {
    if (mutationGuard.current) return;
    mutationGuard.current = true;
    setBusyOffset(offset);
    setOperationError(null);
    try {
      const result = current?.enabled && current.status === 'scheduled'
        ? await coordinator.disable(tripId, offset)
        : await coordinator.enable({ tripId, offsetDays: offset, departureDate });
      if (!result.ok) setOperationError(offset);
      await load();
    } catch {
      setOperationError(offset);
    } finally {
      mutationGuard.current = false;
      setBusyOffset(null);
    }
  }, [coordinator, departureDate, load, tripId]);

  if (state.status === 'loading' || state.tripId !== tripId) return <LoadingState message="正在加载提醒" />;
  if (state.status === 'error') {
    return <ErrorState message={UI_MESSAGES.reminderRead} onRetry={() => { setState({ status: 'loading' }); void load(); }} />;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>旅行提醒</Text>
      <Text style={styles.explanation}>按设备当前本地时区，在提醒日期上午 09:00 安排。</Text>
      {platform === 'android' ? <Text style={styles.explanation}>Android 采用尽力调度，实际送达可能延迟；打开或返回应用后会按当前时区更新安排，应用关闭期间切换时区不保证自动跟随。</Text> : null}
      {OFFSETS.map((offset) => {
        const current = state.reminders.find((value) => value.offsetDays === offset);
        const busy = busyOffset === offset;
        const retry = operationError === offset || current?.status === 'permission_denied' || current?.status === 'unavailable' || current?.status === 'error';
        const active = current?.enabled === true && current.status === 'scheduled';
        const label = retry ? `重试提前 ${offset} 天提醒` : active ? `关闭提前 ${offset} 天提醒` : `开启提前 ${offset} 天提醒`;
        return (
          <View key={offset} style={styles.row}>
            <Text style={styles.label}>提前 {offset} 天</Text>
            <ReminderStatusText reminder={current} operationFailed={operationError === offset} />
            <ActionButton label={label} busyLabel="正在更新提醒" busy={busy} disabled={busyOffset !== null && !busy} onPress={() => { void update(offset, current); }} />
          </View>
        );
      })}
    </View>
  );
}

function ReminderStatusText({ reminder, operationFailed }: { reminder?: Reminder; operationFailed: boolean }) {
  let label = '未开启';
  let alert = false;
  if (operationFailed || reminder?.status === 'error') { label = UI_MESSAGES.reminderUpdate; alert = true; }
  else if (reminder?.status === 'permission_denied') { label = UI_MESSAGES.reminderPermissionDenied; alert = true; }
  else if (reminder?.status === 'unavailable') { label = UI_MESSAGES.reminderUnavailable; alert = true; }
  else if (reminder?.status === 'pending') label = '正在更新';
  else if (reminder?.status === 'scheduled') label = '已安排';
  return <Text accessibilityRole={alert ? 'alert' : undefined} style={[styles.status, alert && styles.error]}>{label}</Text>;
}

const styles = StyleSheet.create({
  section: { padding: 16, gap: 12, backgroundColor: '#FFFFFF' },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: '#111111' },
  explanation: { fontSize: 15, lineHeight: 22, color: '#4A545E', flexShrink: 1 },
  row: { gap: 8, paddingVertical: 8 },
  label: { fontSize: 17, lineHeight: 25, fontWeight: '600', color: '#111111' },
  status: { fontSize: 15, lineHeight: 22, color: '#32404D' },
  error: { color: '#8A1C1C' },
});
