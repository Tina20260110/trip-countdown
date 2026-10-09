import type {
  NotificationAdapter,
  NotificationPermission,
} from '../../src/features/reminders/notification-adapter';
import {
  enableReminderPermission,
  observeReminderPermission,
} from '../../src/features/reminders/permission';

function adapterWith(
  permission: NotificationPermission,
  requested: NotificationPermission = permission,
): jest.Mocked<NotificationAdapter> {
  return {
    getPermission: jest.fn().mockResolvedValue({ ok: true, value: permission }),
    requestPermission: jest.fn().mockResolvedValue({ ok: true, value: requested }),
    schedule: jest.fn(),
    cancel: jest.fn(),
    listScheduled: jest.fn(),
    cleanupDelivered: jest.fn(),
  };
}

describe('reminder permission flow', () => {
  it('only observes permission during normal browsing', async () => {
    const adapter = adapterWith({ status: 'undetermined', canAskAgain: true });

    await expect(observeReminderPermission(adapter)).resolves.toEqual({
      ok: true,
      value: { status: 'undetermined', message: '开启提醒时将请求通知权限。' },
    });
    expect(adapter.requestPermission).not.toHaveBeenCalled();
  });

  it('requests permission only from an explicit enable path', async () => {
    const adapter = adapterWith(
      { status: 'undetermined', canAskAgain: true },
      { status: 'granted', canAskAgain: true },
    );

    await expect(enableReminderPermission(adapter)).resolves.toEqual({
      ok: true,
      value: { status: 'granted', message: '通知权限已开启。' },
    });
    expect(adapter.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('does not request again when permission is denied and cannot be asked again', async () => {
    const adapter = adapterWith({ status: 'denied', canAskAgain: false });

    await expect(enableReminderPermission(adapter)).resolves.toEqual({
      ok: true,
      value: {
        status: 'denied',
        message: '通知权限未开启，提醒未启用。请前往系统设置开启通知。',
      },
    });
    expect(adapter.requestPermission).not.toHaveBeenCalled();
  });

  it('reports a denied request without blocking core features', async () => {
    const adapter = adapterWith(
      { status: 'undetermined', canAskAgain: true },
      { status: 'denied', canAskAgain: false },
    );

    await expect(enableReminderPermission(adapter)).resolves.toMatchObject({
      ok: true,
      value: { status: 'denied' },
    });
  });

  it('detects permission revoked after it was previously granted', async () => {
    const adapter = adapterWith({ status: 'denied', canAskAgain: true });

    await expect(observeReminderPermission(adapter)).resolves.toEqual({
      ok: true,
      value: {
        status: 'denied',
        message: '通知权限未开启，提醒未启用。',
      },
    });
    expect(adapter.requestPermission).not.toHaveBeenCalled();
  });
});
