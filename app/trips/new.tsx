import { useRouter } from 'expo-router';

import { CreateTripScreen } from '@/src/features/trips/CreateTripScreen';

export default function CreateTripRoute() {
  const router = useRouter();
  return <CreateTripScreen onCreated={() => router.replace('/')} />;
}
