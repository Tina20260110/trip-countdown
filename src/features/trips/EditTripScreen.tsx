import { useCallback, useEffect, useRef, useState } from 'react';

import { ErrorState, LoadingState } from '../../components/AsyncState';
import type { TripRepository } from '../../contracts/repositories';
import type { TripInput, ValidationError } from '../../domain/types';
import { validateEditTripInput } from '../../domain/validation';
import { useOptionalAppDependencies } from '../bootstrap/BootstrapGate';
import { TripForm } from './TripForm';

type EditState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'not-found' }
  | { status: 'error' };

interface EditTripScreenProps {
  tripId: string;
  repository?: TripRepository;
  onBack: () => void;
  onSaved: (id: number) => void;
}

function parseTripId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function EditTripScreen({ tripId: rawTripId, repository: repositoryOverride, onBack, onSaved }: EditTripScreenProps) {
  const dependencies = useOptionalAppDependencies();
  const repository = repositoryOverride ?? dependencies?.tripRepository;
  if (!repository) throw new Error('TripRepository is unavailable before bootstrap is ready');
  const tripRepository = repository;
  const tripId = parseTripId(rawTripId);
  const [state, setState] = useState<EditState>(tripId === null ? { status: 'not-found' } : { status: 'loading' });
  const [value, setValue] = useState<TripInput>({ destination: '', departureDate: '', notes: '' });
  const [errors, setErrors] = useState<ValidationError['fieldErrors']>({});
  const [submitError, setSubmitError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    if (tripId === null) return;
    const request = ++requestSequence.current;
    const result = await tripRepository.get(tripId);
    if (request !== requestSequence.current) return;
    if (result.ok) {
      setValue({ destination: result.value.destination, departureDate: result.value.departureDate, notes: result.value.notes });
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
    setBusy(true);
    setErrors({});
    setSubmitError(undefined);
    try {
      const result = await tripRepository.update(tripId, validated.value);
      if (result.ok) onSaved(tripId);
      else if (result.error.kind === 'validation') setErrors(result.error.fieldErrors);
      else if (result.error.kind === 'not-found') setState({ status: 'not-found' });
      else setSubmitError('保存失败，请重试');
    } catch {
      setSubmitError('保存失败，请重试');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (state.status === 'loading') return <LoadingState message="正在加载旅行" />;
  if (state.status === 'not-found') {
    return <ErrorState message="旅行不存在" retryLabel="返回旅行详情" onRetry={onBack} />;
  }
  if (state.status === 'error') {
    return <ErrorState message="读取旅行失败，请重试" onRetry={() => {
      setState({ status: 'loading' });
      void load();
    }} />;
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
