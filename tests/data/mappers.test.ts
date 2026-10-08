import {
  mapChecklistItemRow,
  mapReminderRow,
  mapTripRow,
} from '../../src/data/mappers';
import {
  notFoundError,
  unavailableError,
  type RepositoryResult,
} from '../../src/data/repository-result';

describe('SQLite row mappers', () => {
  it('maps validated trip, checklist, and reminder rows into domain models', () => {
    expect(
      mapTripRow({
        id: 1,
        destination: '东京',
        departure_date: '2028-02-29',
        notes: '带护照',
        created_at: 10,
        updated_at: 11,
      }),
    ).toEqual({
      ok: true,
      value: {
        id: 1,
        destination: '东京',
        departureDate: '2028-02-29',
        notes: '带护照',
        createdAt: 10,
        updatedAt: 11,
      },
    });

    expect(
      mapChecklistItemRow({
        id: 2,
        trip_id: 1,
        title: '充电器',
        completed: 1,
        created_at: 12,
      }),
    ).toEqual({
      ok: true,
      value: {
        id: 2,
        tripId: 1,
        title: '充电器',
        completed: true,
        createdAt: 12,
      },
    });

    expect(
      mapReminderRow({
        trip_id: 1,
        offset_days: 7,
        enabled: 1,
        status: 'scheduled',
        revision: 3,
        notification_id: 'reminder-1-7-3',
        target_date: '2028-02-22',
        scheduled_at: 100,
        scheduled_timezone: 'Asia/Shanghai',
        error_code: null,
      }),
    ).toEqual({
      ok: true,
      value: {
        tripId: 1,
        offsetDays: 7,
        enabled: true,
        status: 'scheduled',
        revision: 3,
        notificationId: 'reminder-1-7-3',
        targetDate: '2028-02-22',
        scheduledAt: 100,
        scheduledTimezone: 'Asia/Shanghai',
        errorCode: null,
      },
    });
  });

  it.each([
    ['primitive type', () => mapTripRow({ id: '1' })],
    [
      'date-only',
      () =>
        mapTripRow({
          id: 1,
          destination: 'Tokyo',
          departure_date: '2025-02-29',
          notes: '',
          created_at: 1,
          updated_at: 1,
        }),
    ],
    [
      'boolean integer',
      () =>
        mapChecklistItemRow({
          id: 1,
          trip_id: 1,
          title: 'Passport',
          completed: 2,
          created_at: 1,
        }),
    ],
    [
      'reminder enum',
      () =>
        mapReminderRow({
          trip_id: 1,
          offset_days: 7,
          enabled: 1,
          status: 'unknown',
          revision: 0,
          notification_id: 'id',
          target_date: null,
          scheduled_at: null,
          scheduled_timezone: null,
          error_code: null,
        }),
    ],
    [
      'reminder offset',
      () =>
        mapReminderRow({
          trip_id: 1,
          offset_days: 3,
          enabled: 1,
          status: 'pending',
          revision: 0,
          notification_id: 'id',
          target_date: null,
          scheduled_at: null,
          scheduled_timezone: null,
          error_code: null,
        }),
    ],
  ])('returns a storage error for corrupt %s', (_name, map) => {
    expect(map()).toEqual({
      ok: false,
      error: {
        kind: 'storage',
        code: 'corrupt-data',
        message: '本地数据暂时不可用，请重试',
        retryable: true,
      },
    });
  });

  it('does not treat an absent or corrupt row as empty/not-found', () => {
    const result = mapTripRow(null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('storage');
      expect(result.error.code).toBe('corrupt-data');
    }
  });

  it('never includes SQL, paths, or user content in corrupt-row errors', () => {
    const sensitive = {
      id: 'SELECT * FROM trips',
      destination: 'Secret Tokyo',
      departure_date: '/private/user/database.sqlite',
      notes: 'Secret notes',
      title: 'Secret checklist item',
    };
    const serialized = JSON.stringify(mapTripRow(sensitive));

    expect(serialized).not.toContain('SELECT');
    expect(serialized).not.toContain('/private');
    expect(serialized).not.toContain('Secret');
  });
});

describe('repository result boundary', () => {
  it('represents not-found and unavailable separately from storage errors', () => {
    const missing: RepositoryResult<never> = {
      ok: false,
      error: notFoundError(),
    };
    const unavailable: RepositoryResult<never> = {
      ok: false,
      error: unavailableError(),
    };

    expect(missing.error).toEqual({
      kind: 'not-found',
      message: '旅行不存在',
    });
    expect(unavailable.error).toEqual({
      kind: 'unavailable',
      message: '本地数据暂时不可用，请重试',
    });
  });
});
