import { useEffect } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { TripRepository } from '../../contracts/repositories';
import { ActionButton, EmptyState, ErrorState, LoadingState } from '../../components/AsyncState';
import { UI_MESSAGES } from '../../components/ui-messages';
import { calculateCountdown } from '../../domain/countdown';
import { formatChecklistProgress } from '../../domain/checklist-progress';
import { parseDateOnly } from '../../domain/date-only';
import type { TripSummary } from '../../domain/types';
import { useOptionalAppDependencies } from '../bootstrap/BootstrapGate';
import { defaultTripsLifecycle, getSystemNow, type TripsLifecycle, useTrips } from './useTrips';

interface TripsScreenProps {
  repository?: TripRepository;
  getNow?: () => Date;
  lifecycle?: TripsLifecycle;
  onCreateTrip?: () => void;
  onOpenTrip?: (id: number) => void;
  focusSignal?: number;
}

function TripCard({ trip, localToday, onPress }: {
  trip: TripSummary;
  localToday: string;
  onPress: () => void;
}) {
  const today = parseDateOnly(localToday);
  const countdown = today.ok ? calculateCountdown(trip.departureDate, today.value) : null;
  const countdownLabel = countdown?.ok ? countdown.value.label : '倒计时不可用';
  const progress = formatChecklistProgress(trip.checklistProgress)?.label ?? null;
  const accessibilityLabel = [trip.destination, countdownLabel, progress].filter(Boolean).join('，');

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      focusable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Text style={styles.destination}>{trip.destination}</Text>
      <Text style={styles.detail}>{trip.departureDate}</Text>
      <Text style={styles.countdown}>{countdownLabel}</Text>
      {progress ? <Text style={styles.detail}>{progress}</Text> : null}
    </Pressable>
  );
}

export function TripsScreen({
  repository: repositoryOverride,
  getNow = getSystemNow,
  lifecycle = defaultTripsLifecycle,
  onCreateTrip,
  onOpenTrip,
  focusSignal,
}: TripsScreenProps = {}) {
  const dependencies = useOptionalAppDependencies();
  const repository = repositoryOverride ?? dependencies?.tripRepository;
  if (!repository) throw new Error('TripRepository is unavailable before bootstrap is ready');
  const router = useRouter();
  const { state, refresh, retry } = useTrips(repository, getNow, lifecycle);

  useEffect(() => {
    if (focusSignal !== undefined && focusSignal > 0) void refresh();
  }, [focusSignal, refresh]);

  const createTrip = onCreateTrip ?? (() => router.push('/trips/new' as Href));
  const openTrip = onOpenTrip ?? ((id: number) => router.push(`/trips/${id}` as Href));

  if (state.status === 'loading') return <LoadingState message="正在加载旅行" />;
  if (state.status === 'error') {
    return <ErrorState message={UI_MESSAGES.tripRead} onRetry={retry} />;
  }

  if (state.trips.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState message="还没有旅行" />
        <ActionButton label="创建旅行" onPress={createTrip} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        {state.trips.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            localToday={state.localToday}
            onPress={() => openTrip(trip.id)}
          />
        ))}
      </ScrollView>
      <View style={styles.createAction}>
        <ActionButton label="创建旅行" onPress={createTrip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: 24, gap: 8 },
  list: { padding: 16, gap: 12 },
  card: { minHeight: 48, padding: 16, borderWidth: 1, borderColor: '#C5CBD1', borderRadius: 10, gap: 4 },
  pressed: { opacity: 0.7 },
  destination: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: '#111111' },
  detail: { fontSize: 16, lineHeight: 24, color: '#39434D' },
  countdown: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#174D78' },
  createAction: { padding: 16 },
});
