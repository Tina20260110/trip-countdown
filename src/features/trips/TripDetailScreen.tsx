import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton, ErrorState, LoadingState } from '../../components/AsyncState';
import { UI_MESSAGES } from '../../components/ui-messages';
import type { ChecklistRepository, ReminderRepository, TripRepository } from '../../contracts/repositories';
import { calculateCountdown } from '../../domain/countdown';
import { getLocalDateOnly } from '../../domain/date-only';
import type { TripDetail } from '../../domain/types';
import { useOptionalAppDependencies } from '../bootstrap/BootstrapGate';
import { ChecklistSection } from '../checklist/ChecklistSection';
import { ReminderSection } from '../reminders/ReminderSection';
import type { ReminderCoordinator } from '../reminders/reminder-coordinator';
import { unavailableTripDeletionPort, type TripDeletionPort } from './trip-deletion-port';
import { useDeleteTrip } from './useDeleteTrip';
import { getSystemNow } from './useTrips';

type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; trip: TripDetail }
  | { status: 'not-found' }
  | { status: 'error' };

interface TripDetailScreenProps {
  tripId: string;
  repository?: TripRepository;
  checklistRepository?: ChecklistRepository;
  reminderRepository?: ReminderRepository;
  reminderCoordinator?: Pick<ReminderCoordinator, 'enable' | 'disable'>;
  reminderPlatform?: 'ios' | 'android';
  deletionPort?: TripDeletionPort;
  getNow?: () => Date;
  focusSignal?: number;
  onBack: () => void;
  onEdit: (id: number) => void;
  onDeleted: () => void;
}

function parseTripId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function TripDetailScreen({
  tripId: rawTripId,
  repository: repositoryOverride,
  checklistRepository: checklistRepositoryOverride,
  reminderRepository: reminderRepositoryOverride,
  reminderCoordinator: reminderCoordinatorOverride,
  reminderPlatform,
  deletionPort: deletionPortOverride,
  getNow = getSystemNow,
  focusSignal,
  onBack,
  onEdit,
  onDeleted,
}: TripDetailScreenProps) {
  const dependencies = useOptionalAppDependencies();
  const repository = repositoryOverride ?? dependencies?.tripRepository;
  const checklistRepository = checklistRepositoryOverride ?? dependencies?.checklistRepository;
  const deletionPort = deletionPortOverride ?? dependencies?.tripDeletionPort ?? unavailableTripDeletionPort;
  const reminderRepository = reminderRepositoryOverride ?? dependencies?.reminderRepository;
  const reminderCoordinator = reminderCoordinatorOverride ?? dependencies?.reminderCoordinator;
  if (!repository) throw new Error('TripRepository is unavailable before bootstrap is ready');
  if (!checklistRepository) throw new Error('ChecklistRepository is unavailable before bootstrap is ready');
  const tripRepository = repository;
  const tripId = parseTripId(rawTripId);
  const [state, setState] = useState<DetailState>(tripId === null ? { status: 'not-found' } : { status: 'loading' });
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    if (tripId === null) return;
    const request = ++requestSequence.current;
    let result: Awaited<ReturnType<TripRepository['get']>>;
    try {
      result = await tripRepository.get(tripId);
    } catch {
      if (request === requestSequence.current) setState({ status: 'error' });
      return;
    }
    if (request !== requestSequence.current) return;
    if (result.ok) setState({ status: 'ready', trip: result.value });
    else if (result.error.kind === 'not-found') setState({ status: 'not-found' });
    else setState({ status: 'error' });
  }, [tripId, tripRepository]);

  useEffect(() => {
    let active = true;
    if (tripId !== null) {
      void Promise.resolve().then(() => active ? load() : undefined);
    }
    return () => {
      active = false;
      requestSequence.current += 1;
    };
  }, [load, tripId]);

  useEffect(() => {
    let active = true;
    if (tripId !== null && focusSignal !== undefined && focusSignal > 0) {
      void Promise.resolve().then(() => active ? load() : undefined);
    }
    return () => { active = false; };
  }, [focusSignal, load, tripId]);

  const deletion = useDeleteTrip(tripId ?? 0, deletionPort, onDeleted);

  if (state.status === 'loading') return <LoadingState message="正在加载旅行" />;
  if (state.status === 'not-found') {
    return <MessageWithAction message="旅行不存在" action="返回旅行列表" onPress={onBack} />;
  }
  if (state.status === 'error') {
    return <ErrorState message={UI_MESSAGES.tripRead} onRetry={() => {
      setState({ status: 'loading' });
      void load();
    }} />;
  }

  const countdown = calculateCountdown(state.trip.departureDate, getLocalDateOnly(getNow()));
  const countdownLabel = countdown.ok ? countdown.value.label : '倒计时不可用';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{state.trip.destination}</Text>
      <Text style={styles.countdown}>{countdownLabel}</Text>
      <Text style={styles.label}>出发日期</Text>
      <Text style={styles.value}>{state.trip.departureDate}</Text>
      <Text style={styles.label}>备注</Text>
      <Text style={styles.value}>{state.trip.notes === '' ? '没有备注' : state.trip.notes}</Text>
      <ChecklistSection tripId={state.trip.id} repository={checklistRepository} refreshSignal={focusSignal} />
      {reminderRepository && reminderCoordinator ? (
        <ReminderSection
          tripId={state.trip.id}
          departureDate={state.trip.departureDate}
          repository={reminderRepository}
          coordinator={reminderCoordinator}
          platform={reminderPlatform}
          refreshSignal={focusSignal}
        />
      ) : null}
      <View style={styles.actions}>
        <ActionButton label="编辑旅行" disabled={deletion.isDeleting} onPress={() => onEdit(state.trip.id)} />
        <ActionButton label="删除旅行" disabled={deletion.isDeleting} onPress={deletion.requestDelete} />
      </View>
      {deletion.confirming ? (
        <View style={styles.confirmation}>
          <Text style={styles.confirmationTitle}>确定删除这次旅行吗？</Text>
          <Text style={styles.value}>删除后无法恢复。</Text>
          {deletion.error ? <Text accessibilityRole="alert" style={styles.error}>{UI_MESSAGES.tripDelete}</Text> : null}
          <View style={styles.actions}>
            <ActionButton label="取消删除" disabled={deletion.isDeleting} onPress={deletion.cancelDelete} />
            <ActionButton
              label={deletion.error ? '重试删除' : '确认删除'}
              busyLabel="正在删除"
              busy={deletion.isDeleting}
              onPress={deletion.confirmDelete}
            />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function MessageWithAction({ message, action, onPress }: { message: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.messageState}>
      <Text style={styles.title}>{message}</Text>
      <ActionButton label={action} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 10, backgroundColor: '#FFFFFF' },
  messageState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 18 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '700', color: '#111111' },
  countdown: { fontSize: 20, lineHeight: 28, fontWeight: '600', color: '#174D78' },
  label: { marginTop: 8, fontSize: 15, lineHeight: 22, fontWeight: '600', color: '#4A545E' },
  value: { fontSize: 17, lineHeight: 25, color: '#111111' },
  actions: { marginTop: 10, gap: 10 },
  confirmation: { marginTop: 12, padding: 16, gap: 8, borderWidth: 1, borderColor: '#A12424', borderRadius: 10 },
  confirmationTitle: { fontSize: 18, lineHeight: 26, fontWeight: '700', color: '#111111' },
  error: { color: '#8A1C1C', fontSize: 15, lineHeight: 22 },
});
