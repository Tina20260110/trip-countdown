import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { TripDetailScreen } from '@/src/features/trips/TripDetailScreen';

export default function TripDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const [focusSignal, setFocusSignal] = useState(0);
  const hasFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (hasFocused.current) setFocusSignal((value) => value + 1);
    else hasFocused.current = true;
  }, []));
  const tripId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  return (
    <TripDetailScreen
      tripId={tripId}
      focusSignal={focusSignal}
      onBack={() => router.replace('/')}
      onEdit={(value) => router.push(`/trips/${value}/edit` as Href)}
      onDeleted={() => router.replace('/')}
    />
  );
}
