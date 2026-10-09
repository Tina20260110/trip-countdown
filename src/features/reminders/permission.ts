import type { Result } from '../../domain/types';
import type {
  NotificationAdapter,
  NotificationAdapterError,
  NotificationPermission,
  NotificationPermissionStatus,
} from './notification-adapter';

export interface ReminderPermissionState {
  status: NotificationPermissionStatus;
  message: string;
}

export type ReminderPermissionResult = Result<
  ReminderPermissionState,
  NotificationAdapterError
>;

function presentPermission(
  permission: NotificationPermission,
): ReminderPermissionState {
  if (permission.status === 'granted') {
    return { status: 'granted', message: '通知权限已开启。' };
  }
  if (permission.status === 'undetermined') {
    return {
      status: 'undetermined',
      message: '开启提醒时将请求通知权限。',
    };
  }
  return {
    status: 'denied',
    message: permission.canAskAgain
      ? '通知权限未开启，提醒未启用。'
      : '通知权限未开启，提醒未启用。请前往系统设置开启通知。',
  };
}

export async function observeReminderPermission(
  adapter: NotificationAdapter,
): Promise<ReminderPermissionResult> {
  const permission = await adapter.getPermission();
  return permission.ok
    ? { ok: true, value: presentPermission(permission.value) }
    : permission;
}

export async function enableReminderPermission(
  adapter: NotificationAdapter,
): Promise<ReminderPermissionResult> {
  const current = await adapter.getPermission();
  if (!current.ok) return current;

  if (
    current.value.status !== 'undetermined' ||
    !current.value.canAskAgain
  ) {
    return { ok: true, value: presentPermission(current.value) };
  }

  const requested = await adapter.requestPermission();
  return requested.ok
    ? { ok: true, value: presentPermission(requested.value) }
    : requested;
}
