import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { TripsScreen } from '@/src/features/trips/TripsScreen';

export default function TripsRoute() {
  const [focusSignal, setFocusSignal] = useState(0);
  const hasFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (hasFocused.current) {
      setFocusSignal((value) => value + 1);
    } else {
      hasFocused.current = true;
    }
  }, []));
  return <TripsScreen focusSignal={focusSignal} />;
}
