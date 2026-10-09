import type { Result } from '../../domain/types';

export type NotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined';

export interface NotificationPermission {
  status: NotificationPermissionStatus;
  canAskAgain: boolean;
}

export type NotificationTrigger =
  | {
      platform: 'ios';
      type: 'calendar';
      year: number;
      month: number;
      day: number;
      hour: 9;
      minute: 0;
      second: 0;
      repeats: false;
    }
  | {
      platform: 'android';
      type: 'date';
      date: number;
      channelId: string;
      repeats: false;
    };

export interface NotificationScheduleRequest {
  identifier: string;
  trigger: NotificationTrigger;
}

export interface ScheduledNotification {
  identifier: string;
}

export interface NotificationAdapterError {
  kind: 'unavailable' | 'permission-denied' | 'scheduling';
  message: string;
}

export type NotificationAdapterResult<T> = Result<T, NotificationAdapterError>;

export interface NotificationAdapter {
  getPermission(): Promise<NotificationAdapterResult<NotificationPermission>>;
  requestPermission(): Promise<NotificationAdapterResult<NotificationPermission>>;
  schedule(
    request: NotificationScheduleRequest,
  ): Promise<NotificationAdapterResult<string>>;
  cancel(identifier: string): Promise<NotificationAdapterResult<void>>;
  listScheduled(): Promise<
    NotificationAdapterResult<readonly ScheduledNotification[]>
  >;
  cleanupDelivered(identifier: string): Promise<NotificationAdapterResult<void>>;
}
