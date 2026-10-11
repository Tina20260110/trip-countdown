import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { ErrorState, LoadingState } from '../../components/AsyncState';
import { UI_MESSAGES } from '../../components/ui-messages';
import type {
  AppDependencies,
  BootstrapPort,
  BootstrapState,
} from './types';

const DependenciesContext = createContext<AppDependencies | null>(null);

export function useAppDependencies(): AppDependencies {
  const dependencies = useContext(DependenciesContext);
  if (!dependencies) {
    throw new Error('App dependencies are unavailable before bootstrap is ready');
  }
  return dependencies;
}

export function useOptionalAppDependencies(): AppDependencies | null {
  return useContext(DependenciesContext);
}

interface BootstrapGateProps {
  bootstrap: BootstrapPort;
  children: ReactNode;
}

export function BootstrapGate({ bootstrap, children }: BootstrapGateProps) {
  const [state, setState] = useState<BootstrapState>({ status: 'initializing' });
  const inFlight = useRef<ReturnType<BootstrapPort['initialize']> | null>(null);
  const mounted = useRef(true);

  const initialize = useCallback(() => {
    if (inFlight.current) return;

    setState({ status: 'initializing' });
    const request = bootstrap.initialize();
    inFlight.current = request;
    void request
      .then((result) => {
        if (!mounted.current) return;
        setState(
          result.ok
            ? { status: 'ready', dependencies: result.value }
            : { status: 'failed' },
        );
      })
      .catch(() => {
        if (mounted.current) setState({ status: 'failed' });
      })
      .finally(() => {
        if (inFlight.current === request) inFlight.current = null;
      });
  }, [bootstrap]);

  useEffect(() => {
    mounted.current = true;
    initialize();
    return () => {
      mounted.current = false;
    };
  }, [initialize]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void state.dependencies.reminderReconciler.reconcile().catch(() => undefined);
      }
    });
    return () => subscription?.remove();
  }, [state]);

  if (state.status === 'initializing') return <LoadingState />;
  if (state.status === 'failed') {
    return <ErrorState message={UI_MESSAGES.bootstrapRead} onRetry={initialize} />;
  }

  return (
    <DependenciesContext.Provider value={state.dependencies}>
      {children}
    </DependenciesContext.Provider>
  );
}
