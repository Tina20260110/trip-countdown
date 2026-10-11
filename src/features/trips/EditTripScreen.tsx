import { useCallback, useEffect, useRef, useState } from 'react';

import { ErrorState, LoadingState } from '../../components/AsyncState';
import { UI_MESSAGES, type SafeUiMessage } from '../../components/ui-messages';
import type { TripRepository } from '../../contracts/repositories';
import type { TripInput, ValidationError } from '../../domain/types';
import { validateEditTripInput } from '../../domain/validation';
import { useOptionalAppDependencies } from '../bootstrap/BootstrapGate';
import type { ReminderCoordinator } from '../reminders/reminder-coordinator';
import { TripForm } from './TripForm';

type EditState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'not-found' }
  | { status: 'error' };

interface EditTripScreenProps {
  tripId: string;
  repository?: TripRepository;
  reminderCoordinator?: Pick<ReminderCoordinator, 'rescheduleForTrip'>;
  onBack: () => void;
  onSaved: (id: number) => void;
}

function parseTripId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function EditTripScreen({ tripId: rawTripId, repository: repositoryOverride, reminderCoordinator: coordinatorOverride, onBack, onSaved }: EditTripScreenProps) {
  const dependencies = useOptionalAppDependencies();
  const repository = repositoryOverride ?? dependencies?.tripRepository;
  if (!repository) throw new Error('TripRepository is unavailable before bootstrap is ready');
  const tripRepository = repository;
  const reminderCoordinator = coordinatorOverride ?? dependencies?.reminderCoordinator;
  const tripId = parseTripId(rawTripId);
  const [state, setState] = useState<EditState>(tripId === null ? { status: 'not-found' } : { status: 'loading' });
  const [value, setValue] = useState<TripInput>({ destination: '', departureDate: '', notes: '' });
  const [errors, setErrors] = useState<ValidationError['fieldErrors']>({});
  const [submitError, setSubmitError] = useState<SafeUiMessage>();
  const [busy, setBusy] = useState(false);
  const [savedWithReminderError, setSavedWithReminderError] = useState(false);
  const submitting = useRef(false);
  const requestSequence = useRef(0);
  const persistedDepartureDate = useRef<string | undefined>(undefined);

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
    if (result.ok) {
      setValue({ destination: result.value.destination, departureDate: result.value.departureDate, notes: result.value.notes });
      persistedDepartureDate.current = result.value.departureDate;
      setState({ status: 'ready' });
    } else if (result.error.kind === 'not-found') {
      setState({ status: 'not-found' });
    } else {
      setState({ status: 'error' });
    }
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

  async function submit() {
    if (tripId === null || submitting.current) return;
    const validated = validateEditTripInput(value);
    if (!validated.ok) {
      setErrors(validated.error.fieldErrors);
      setSubmitError(undefined);
      return;
    }
    submitting.current = true;
    const departureDateChanged =
      persistedDepartureDate.current !== validated.value.departureDate;
    setBusy(true);
    setErrors({});
    setSubmitError(undefined);
    try {
      const result = await tripRepository.update(tripId, validated.value);
      if (result.ok) {
        persistedDepartureDate.current = result.value.departureDate;
        if (departureDateChanged && reminderCoordinator) {
          try {
            const reminders = await reminderCoordinator.rescheduleForTrip(
              tripId,
              result.value.departureDate,
            );
            if (!reminders.ok) {
              setSavedWithReminderError(true);
              return;
            }
          } catch {
            setSavedWithReminderError(true);
            return;
          }
        }
        onSaved(tripId);
      }
      else if (result.error.kind === 'validation') setErrors(result.error.fieldErrors);
      else if (result.error.kind === 'not-found') setState({ status: 'not-found' });
      else setSubmitError(UI_MESSAGES.tripSave);
    } catch {
      setSubmitError(UI_MESSAGES.tripSave);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (state.status === 'loading') return <LoadingState message="正在加载旅行" />;
  if (state.status === 'not-found') {
    return <ErrorState message={UI_MESSAGES.tripNotFound} retryLabel="返回旅行详情" onRetry={onBack} />;
  }
  if (state.status === 'error') {
    return <ErrorState message={UI_MESSAGES.tripRead} onRetry={() => {
      setState({ status: 'loading' });
      void load();
    }} />;
  }

  if (savedWithReminderError) {
    return (
      <ErrorState
        message={UI_MESSAGES.tripSavedReminderFailed}
        retryLabel="返回旅行详情"
        onRetry={() => {
          if (tripId !== null) onSaved(tripId);
        }}
      />
    );
  }

  return (
    <TripForm
      value={value}
      errors={errors}
      busy={busy}
      submitError={submitError}
      onChange={setValue}
      onSubmit={() => void submit()}
    />
  );
}
