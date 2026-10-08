import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { EditTripScreen } from '@/src/features/trips/EditTripScreen';

export default function EditTripRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const tripId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  return (
    <EditTripScreen
      tripId={tripId}
      onBack={() => router.back()}
      onSaved={(value) => router.replace(`/trips/${value}` as Href)}
    />
  );
}
