import { useRef, useState } from 'react';

import type { TripRepository } from '../../contracts/repositories';
import { UI_MESSAGES, type SafeUiMessage } from '../../components/ui-messages';
import { getLocalDateOnly } from '../../domain/date-only';
import type { TripInput, ValidationError } from '../../domain/types';
import { validateCreateTripInput } from '../../domain/validation';
import { useOptionalAppDependencies } from '../bootstrap/BootstrapGate';
import { TripForm } from './TripForm';
import { getSystemNow } from './useTrips';

interface CreateTripScreenProps {
  repository?: TripRepository;
  getNow?: () => Date;
  onCreated: () => void;
}

const emptyTrip: TripInput = { destination: '', departureDate: '', notes: '' };

export function CreateTripScreen({ repository: repositoryOverride, getNow = getSystemNow, onCreated }: CreateTripScreenProps) {
  const dependencies = useOptionalAppDependencies();
  const repository = repositoryOverride ?? dependencies?.tripRepository;
  if (!repository) throw new Error('TripRepository is unavailable before bootstrap is ready');
  const tripRepository = repository;
  const [value, setValue] = useState<TripInput>(emptyTrip);
  const [errors, setErrors] = useState<ValidationError['fieldErrors']>({});
  const [submitError, setSubmitError] = useState<SafeUiMessage>();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function submit() {
    if (submitting.current) return;
    const localToday = getLocalDateOnly(getNow()).value;
    const validated = validateCreateTripInput(value, localToday);
    if (!validated.ok) {
      setErrors(validated.error.fieldErrors);
      setSubmitError(undefined);
      return;
    }

    submitting.current = true;
    setBusy(true);
    setErrors({});
    setSubmitError(undefined);
    try {
      const result = await tripRepository.create(validated.value, localToday);
      if (result.ok) {
        onCreated();
      } else if (result.error.kind === 'validation') {
        setErrors(result.error.fieldErrors);
      } else {
        setSubmitError(UI_MESSAGES.tripSave);
      }
    } catch {
      setSubmitError(UI_MESSAGES.tripSave);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
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
