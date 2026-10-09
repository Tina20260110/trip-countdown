import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';

import type { AppDependencies, BootstrapPort } from '../../src/features/bootstrap/types';
import { BootstrapGate } from '../../src/features/bootstrap/BootstrapGate';

const dependencies = {} as AppDependencies;

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('BootstrapGate', () => {
  it('runs reminder reconciliation whenever the ready app returns to foreground', async () => {
    const reconcile = jest.fn().mockResolvedValue({ ok: true, value: undefined });
    let listener: ((state: string) => void) | undefined;
    const subscription = { remove: jest.fn() };
    const appState = jest.spyOn(AppState, 'addEventListener').mockImplementation((_, next) => {
      listener = next as (state: string) => void;
      return subscription;
    });
    const readyDependencies = {
      ...dependencies,
      reminderReconciler: { reconcile },
    } as AppDependencies;

    await render(
      <BootstrapGate bootstrap={{ initialize: jest.fn().mockResolvedValue({ ok: true, value: readyDependencies }) }}>
        <Text>应用路由</Text>
      </BootstrapGate>,
    );
    expect(await screen.findByText('应用路由')).toBeTruthy();
    listener?.('active');
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
    appState.mockRestore();
  });

  it('shows Chinese loading until initialization succeeds, then renders routes', async () => {
    const pending = deferred<Awaited<ReturnType<BootstrapPort['initialize']>>>();
    const bootstrap: BootstrapPort = { initialize: jest.fn(() => pending.promise) };

    await render(
      <BootstrapGate bootstrap={bootstrap}>
        <Text>应用路由</Text>
      </BootstrapGate>,
    );

    expect(await screen.findByText('正在加载')).toBeTruthy();
    expect(screen.queryByText('应用路由')).toBeNull();
    pending.resolve({ ok: true, value: dependencies });
    expect(await screen.findByText('应用路由')).toBeTruthy();
  });

  it('shows a safe error instead of routes when initialization fails', async () => {
    const bootstrap: BootstrapPort = {
      initialize: jest.fn().mockResolvedValue({
        ok: false,
        error: { message: 'SQL /private/path Tokyo Notes' },
      }),
    };

    await render(
      <BootstrapGate bootstrap={bootstrap}>
        <Text>可写业务页面</Text>
      </BootstrapGate>,
    );

    expect(await screen.findByText('读取失败，请重试')).toBeTruthy();
    expect(screen.queryByText('可写业务页面')).toBeNull();
    expect(screen.queryByText(/SQL|\/private|Tokyo|Notes/)).toBeNull();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
  });

  it('retries a failure and enters ready only after a successful retry', async () => {
    const initialize = jest
      .fn<ReturnType<BootstrapPort['initialize']>, Parameters<BootstrapPort['initialize']>>()
      .mockResolvedValueOnce({ ok: false, error: { message: 'unavailable' } })
      .mockResolvedValueOnce({ ok: true, value: dependencies });

    await render(
      <BootstrapGate bootstrap={{ initialize }}>
        <Text>应用路由</Text>
      </BootstrapGate>,
    );
    await fireEvent.press(await screen.findByRole('button', { name: '重试' }));

    expect(await screen.findByText('应用路由')).toBeTruthy();
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it('returns to an error state when retry fails again', async () => {
    const initialize = jest
      .fn<ReturnType<BootstrapPort['initialize']>, Parameters<BootstrapPort['initialize']>>()
      .mockResolvedValue({ ok: false, error: { message: 'unavailable' } });

    await render(<BootstrapGate bootstrap={{ initialize }}><Text>应用路由</Text></BootstrapGate>);
    await fireEvent.press(await screen.findByRole('button', { name: '重试' }));

    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('读取失败，请重试')).toBeTruthy();
    expect(screen.queryByText('应用路由')).toBeNull();
  });

  it('prevents another retry while initialization is in flight', async () => {
    const retry = deferred<Awaited<ReturnType<BootstrapPort['initialize']>>>();
    const initialize = jest
      .fn<ReturnType<BootstrapPort['initialize']>, Parameters<BootstrapPort['initialize']>>()
      .mockResolvedValueOnce({ ok: false, error: { message: 'unavailable' } })
      .mockImplementationOnce(() => retry.promise);

    await render(<BootstrapGate bootstrap={{ initialize }}><Text>应用路由</Text></BootstrapGate>);
    const retryButton = await screen.findByRole('button', { name: '重试' });
    await fireEvent.press(retryButton);

    expect(initialize).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('正在加载')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull();
    retry.resolve({ ok: true, value: dependencies });
    expect(await screen.findByText('应用路由')).toBeTruthy();
  });
});
