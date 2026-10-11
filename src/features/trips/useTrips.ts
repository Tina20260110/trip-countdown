import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { TripRepository } from '../../contracts/repositories';
import { getLocalDateOnly } from '../../domain/date-only';
import type { TripSummary } from '../../domain/types';

export type TripsState =
  | { status: 'loading' }
  | { status: 'ready'; trips: readonly TripSummary[]; localToday: string }
  | { status: 'error' };

export interface TripsLifecycle {
  subscribeToActive(callback: () => void): () => void;
  scheduleAtNextLocalMidnight(now: Date, callback: () => void): () => void;
}

export const defaultTripsLifecycle: TripsLifecycle = {
  subscribeToActive(callback) {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') callback();
    });
    return () => subscription.remove();
  },
  scheduleAtNextLocalMidnight(now, callback) {
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const timer = setTimeout(callback, Math.max(0, nextMidnight.getTime() - now.getTime()));
    return () => clearTimeout(timer);
  },
};

export const getSystemNow = () => new Date();

export function useTrips(
  repository: TripRepository,
  getNow: () => Date = getSystemNow,
  lifecycle: TripsLifecycle = defaultTripsLifecycle,
) {
  const [state, setState] = useState<TripsState>({ status: 'loading' });
  const requestSequence = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
    };
  }, []);

  const refresh = useCallback(async () => {
    const request = ++requestSequence.current;
    const localToday = getLocalDateOnly(getNow()).value;
    let result: Awaited<ReturnType<TripRepository['list']>>;
    try {
      result = await repository.list(localToday);
    } catch {
      if (mounted.current && request === requestSequence.current) {
        setState({ status: 'error' });
      }
      return;
    }
    if (!mounted.current || request !== requestSequence.current) return;
    setState(
      result.ok
        ? { status: 'ready', trips: result.value, localToday }
        : { status: 'error' },
    );
  }, [getNow, repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => lifecycle.subscribeToActive(() => void refresh()), [lifecycle, refresh]);

  useEffect(() => {
    let active = true;
    let cancel: () => void = () => undefined;
    const schedule = () => {
      cancel = lifecycle.scheduleAtNextLocalMidnight(getNow(), () => {
        void refresh().finally(() => {
          if (active) schedule();
        });
      });
    };
    schedule();
    return () => {
      active = false;
      cancel();
    };
  }, [getNow, lifecycle, refresh]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    void refresh();
  }, [refresh]);

  return { state, refresh, retry };
}
