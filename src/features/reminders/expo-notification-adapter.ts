import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type {
  NotificationAdapter,
  NotificationAdapterError,
  NotificationAdapterResult,
  NotificationPermission,
} from './notification-adapter';
import { REMINDER_CHANNEL_ID } from './reminder-time';

export type ExpoNotificationsApi = Pick<
  typeof Notifications,
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'scheduleNotificationAsync'
  | 'cancelScheduledNotificationAsync'
  | 'getAllScheduledNotificationsAsync'
  | 'dismissNotificationAsync'
  | 'setNotificationChannelAsync'
>;

type SupportedPlatform = 'ios' | 'android';

const FIXED_CONTENT = {
  title: '旅行提醒',
  body: '该为旅行做好出发准备了。',
  data: { type: 'trip-reminder' },
  sound: 'default' as const,
};

function safeError(
  kind: NotificationAdapterError['kind'],
  message: string,
): NotificationAdapterResult<never> {
  return { ok: false, error: { kind, message } };
}

function mapPermission(
  permission: Awaited<ReturnType<ExpoNotificationsApi['getPermissionsAsync']>>,
): NotificationPermission {
  const iosGranted =
    permission.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL;

  return {
    status:
      permission.granted || iosGranted
        ? 'granted'
        : permission.status === 'undetermined'
          ? 'undetermined'
          : 'denied',
    canAskAgain: permission.canAskAgain,
  };
}

export function createExpoNotificationAdapter(
  api: ExpoNotificationsApi = Notifications,
  platform: SupportedPlatform | string = Platform.OS,
): NotificationAdapter {
  return {
    async getPermission() {
      try {
        return { ok: true, value: mapPermission(await api.getPermissionsAsync()) };
      } catch {
        return safeError('unavailable', '无法读取通知权限，请重试。');
      }
    },

    async requestPermission() {
      try {
        const permission = await api.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: false, allowSound: true },
        });
        return { ok: true, value: mapPermission(permission) };
      } catch {
        return safeError('unavailable', '无法请求通知权限，请重试。');
      }
    },

    async schedule(request) {
      if (request.trigger.platform !== platform) {
        return safeError('unavailable', '当前平台无法安排此提醒。');
      }

      try {
        if (request.trigger.platform === 'android') {
          await api.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
            name: '旅行提醒',
            description: '旅行出发准备提醒',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
          await api.scheduleNotificationAsync({
            identifier: request.identifier,
            content: FIXED_CONTENT,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: request.trigger.date,
              channelId: request.trigger.channelId,
            },
          });
        } else {
          const { platform: _platform, ...calendar } = request.trigger;
          await api.scheduleNotificationAsync({
            identifier: request.identifier,
            content: FIXED_CONTENT,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              year: calendar.year,
              month: calendar.month,
              day: calendar.day,
              hour: calendar.hour,
              minute: calendar.minute,
              second: calendar.second,
              repeats: calendar.repeats,
            },
          });
        }
        return { ok: true, value: request.identifier };
      } catch {
        return safeError('scheduling', '提醒安排失败，请重试。');
      }
    },

    async cancel(identifier) {
      try {
        await api.cancelScheduledNotificationAsync(identifier);
        return { ok: true, value: undefined };
      } catch {
        return safeError('scheduling', '提醒取消失败，请重试。');
      }
    },

    async listScheduled() {
      try {
        const scheduled = await api.getAllScheduledNotificationsAsync();
        return {
          ok: true,
          value: scheduled.map(({ identifier }) => ({ identifier })),
        };
      } catch {
        return safeError('unavailable', '无法读取已安排的提醒，请重试。');
      }
    },

    async cleanupDelivered(identifier) {
      try {
        await api.dismissNotificationAsync(identifier);
        return { ok: true, value: undefined };
      } catch {
        return safeError('unavailable', '无法清理已显示的提醒。');
      }
    },
  };
}
