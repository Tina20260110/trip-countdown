import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChecklistRepository } from '../../contracts/repositories';
import type { ChecklistItem } from '../../domain/types';
import { validateChecklistItemInput } from '../../domain/validation';
import { UI_MESSAGES, type SafeUiMessage } from '../../components/ui-messages';

export type ChecklistState =
  | { status: 'loading'; tripId: number }
  | { status: 'ready'; tripId: number; items: readonly ChecklistItem[] }
  | { status: 'read-error'; tripId: number }
  | { status: 'refresh-error'; tripId: number; message: SafeUiMessage };

type Mutation =
  | { kind: 'toggle'; itemId: number; completed: boolean }
  | { kind: 'delete'; itemId: number };

export function useChecklist(repository: ChecklistRepository, tripId: number) {
  const [state, setState] = useState<ChecklistState>({ status: 'loading', tripId });
  const [title, setTitleState] = useState('');
  const [titleError, setTitleError] = useState<string>();
  const [addError, setAddError] = useState<SafeUiMessage>();
  const [saving, setSaving] = useState(false);
  const [mutationBusy, setMutationBusy] = useState<Mutation>();
  const [mutationError, setMutationError] = useState<Mutation>();
  const requestSequence = useRef(0);
  const adding = useRef(false);
  const mutating = useRef(false);
  const mounted = useRef(true);

  const read = useCallback(async (
    targetTripId: number,
    failure: { status: 'read-error' } | { status: 'refresh-error'; message: SafeUiMessage },
  ) => {
    const request = ++requestSequence.current;
    try {
      const result = await repository.list(targetTripId);
      if (!mounted.current || request !== requestSequence.current) return;
      setState(
        result.ok
          ? { status: 'ready', tripId: targetTripId, items: result.value }
          : { ...failure, tripId: targetTripId },
      );
    } catch {
      if (mounted.current && request === requestSequence.current) {
        setState({ ...failure, tripId: targetTripId });
      }
    }
  }, [repository]);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    void Promise.resolve().then(() => active ? read(tripId, { status: 'read-error' }) : undefined);
    return () => {
      active = false;
      mounted.current = false;
      requestSequence.current += 1;
    };
  }, [read, tripId]);

  const retryRead = useCallback(() => {
    const refreshFailure = state.status === 'refresh-error';
    if (!refreshFailure) setState({ status: 'loading', tripId });
    void read(
      tripId,
      refreshFailure
        ? { status: 'refresh-error', message: state.status === 'refresh-error' ? state.message : UI_MESSAGES.checklistRefresh }
        : { status: 'read-error' },
    );
  }, [read, state, tripId]);

  function setTitle(value: string) {
    setTitleState(value);
    setTitleError(undefined);
    setAddError(undefined);
  }

  async function add() {
    if (adding.current) return;
    const validated = validateChecklistItemInput({ title });
    if (!validated.ok) {
      setTitleError(validated.error.fieldErrors.title);
      setAddError(undefined);
      return;
    }

    const targetTripId = tripId;
    adding.current = true;
    setSaving(true);
    setTitleError(undefined);
    setAddError(undefined);
    try {
      const result = await repository.add(targetTripId, validated.value);
      if (!mounted.current) return;
      if (!result.ok) {
        setAddError(UI_MESSAGES.checklistAdd);
        return;
      }

      setTitleState('');
      await read(targetTripId, { status: 'refresh-error', message: UI_MESSAGES.checklistSavedRefresh });
    } catch {
      if (mounted.current) {
        setAddError(UI_MESSAGES.checklistAdd);
      }
    } finally {
      if (mounted.current) {
        adding.current = false;
        setSaving(false);
      }
    }
  }

  async function runMutation(mutation: Mutation) {
    if (mutating.current) return;
    mutating.current = true;
    setMutationBusy(mutation);
    setMutationError(undefined);
    try {
      const result = mutation.kind === 'toggle'
        ? await repository.setCompleted(mutation.itemId, mutation.completed)
        : await repository.remove(mutation.itemId);
      if (!mounted.current) return;
      if (!result.ok) {
        setMutationError(mutation);
        return;
      }
      await read(tripId, {
        status: 'refresh-error',
        message: mutation.kind === 'delete'
          ? UI_MESSAGES.checklistDeletedRefresh
          : UI_MESSAGES.checklistStatusRefresh,
      });
    } catch {
      if (mounted.current) setMutationError(mutation);
    } finally {
      if (mounted.current) {
        mutating.current = false;
        setMutationBusy(undefined);
      }
    }
  }

  return {
    state,
    title,
    titleError,
    addError,
    saving,
    mutationBusy,
    mutationError,
    setTitle,
    retryRead,
    add: () => void add(),
    setCompleted: (itemId: number, completed: boolean) => void runMutation({ kind: 'toggle', itemId, completed }),
    remove: (itemId: number) => void runMutation({ kind: 'delete', itemId }),
    retryMutation: () => mutationError ? void runMutation(mutationError) : undefined,
  };
}
