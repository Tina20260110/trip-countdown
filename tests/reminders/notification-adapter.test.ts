jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 5 },
  IosAuthorizationStatus: {
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    DATE: 'date',
  },
}));

import * as Notifications from 'expo-notifications';
import { PermissionStatus } from 'expo';
import {
  createExpoNotificationAdapter,
  type ExpoNotificationsApi,
} from '../../src/features/reminders/expo-notification-adapter';
import type { NotificationScheduleRequest } from '../../src/features/reminders/notification-adapter';
import { REMINDER_CHANNEL_ID } from '../../src/features/reminders/reminder-time';

function createApi(): jest.Mocked<ExpoNotificationsApi> {
  return {
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
    getAllScheduledNotificationsAsync: jest.fn(),
    dismissNotificationAsync: jest.fn(),
    setNotificationChannelAsync: jest.fn(),
  };
}

const iosRequest: NotificationScheduleRequest = {
  identifier: 'trip-42-before-7',
  trigger: {
    platform: 'ios',
    type: 'calendar',
    year: 2026,
    month: 10,
    day: 13,
    hour: 9,
    minute: 0,
    second: 0,
    repeats: false,
  },
};

const androidRequest: NotificationScheduleRequest = {
  identifier: 'trip-42-before-1',
  trigger: {
    platform: 'android',
    type: 'date',
    date: new Date(2026, 9, 19, 9).getTime(),
    channelId: REMINDER_CHANNEL_ID,
    repeats: false,
  },
};

describe('Expo notification adapter', () => {
  it('maps permission without requesting it', async () => {
    const api = createApi();
    api.getPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
      expires: 'never',
      status: PermissionStatus.UNDETERMINED,
    });
    const adapter = createExpoNotificationAdapter(api, 'ios');

    await expect(adapter.getPermission()).resolves.toEqual({
      ok: true,
      value: { status: 'undetermined', canAskAgain: true },
    });
    expect(api.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests only alert permission through its explicit method', async () => {
    const api = createApi();
    api.requestPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
      expires: 'never',
      status: PermissionStatus.DENIED,
    });
    const adapter = createExpoNotificationAdapter(api, 'ios');

    await adapter.requestPermission();

    expect(api.requestPermissionsAsync).toHaveBeenCalledWith({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
  });

  it('schedules iOS with fixed Chinese content and floating calendar components', async () => {
    const api = createApi();
    api.scheduleNotificationAsync.mockResolvedValue(iosRequest.identifier);
    const adapter = createExpoNotificationAdapter(api, 'ios');

    await expect(adapter.schedule(iosRequest)).resolves.toEqual({
      ok: true,
      value: iosRequest.identifier,
    });
    expect(api.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: iosRequest.identifier,
      content: {
        title: '旅行提醒',
        body: '该为旅行做好出发准备了。',
        data: { type: 'trip-reminder' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        year: 2026,
        month: 10,
        day: 13,
        hour: 9,
        minute: 0,
        second: 0,
        repeats: false,
      },
    });
    expect(api.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('creates the Android channel and schedules a best-effort date trigger', async () => {
    const api = createApi();
    api.setNotificationChannelAsync.mockResolvedValue(null);
    api.scheduleNotificationAsync.mockResolvedValue(androidRequest.identifier);
    const adapter = createExpoNotificationAdapter(api, 'android');

    await adapter.schedule(androidRequest);

    expect(api.setNotificationChannelAsync).toHaveBeenCalledWith(
      REMINDER_CHANNEL_ID,
      expect.objectContaining({
        name: '旅行提醒',
        importance: Notifications.AndroidImportance.DEFAULT,
      }),
    );
    const trigger = androidRequest.trigger;
    if (trigger.platform !== 'android') throw new Error('Expected Android trigger');
    expect(api.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: androidRequest.identifier,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger.date,
          channelId: REMINDER_CHANNEL_ID,
        },
      }),
    );
  });

  it('rejects a trigger for the wrong platform', async () => {
    const api = createApi();
    const adapter = createExpoNotificationAdapter(api, 'android');

    await expect(adapter.schedule(iosRequest)).resolves.toEqual({
      ok: false,
      error: { kind: 'unavailable', message: '当前平台无法安排此提醒。' },
    });
    expect(api.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels, lists, and cleans up by opaque identifiers', async () => {
    const api = createApi();
    api.cancelScheduledNotificationAsync.mockResolvedValue();
    api.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'trip-42-before-7',
        content: {},
        trigger: null,
      },
    ] as unknown as Awaited<
      ReturnType<ExpoNotificationsApi['getAllScheduledNotificationsAsync']>
    >);
    api.dismissNotificationAsync.mockResolvedValue();
    const adapter = createExpoNotificationAdapter(api, 'ios');

    await expect(adapter.cancel('trip-42-before-7')).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    await expect(adapter.listScheduled()).resolves.toEqual({
      ok: true,
      value: [{ identifier: 'trip-42-before-7' }],
    });
    await expect(
      adapter.cleanupDelivered('trip-42-before-7'),
    ).resolves.toEqual({ ok: true, value: undefined });
  });

  it('maps native failures without exposing their messages', async () => {
    const api = createApi();
    api.scheduleNotificationAsync.mockRejectedValue(
      new Error('SQL /private/user/Tokyo'),
    );
    const adapter = createExpoNotificationAdapter(api, 'ios');

    await expect(adapter.schedule(iosRequest)).resolves.toEqual({
      ok: false,
      error: { kind: 'scheduling', message: '提醒安排失败，请重试。' },
    });
  });
});
