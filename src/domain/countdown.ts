import {
  formatDateOnly,
  parseDateOnly,
  toUtcDayOrdinal,
  type DateOnlyComponents,
  type InvalidDateOnlyError,
} from './date-only';
import type { Result } from './types';

export type Countdown =
  | {
      status: 'future';
      daysRemaining: number;
      label: string;
    }
  | {
      status: 'today';
      daysRemaining: 0;
      label: '今天出发';
    }
  | {
      status: 'completed';
      daysRemaining: number;
      label: '旅行已结束';
    };

export function calculateCountdown(
  departureDate: string,
  localToday: DateOnlyComponents,
): Result<Countdown, InvalidDateOnlyError> {
  const departure = parseDateOnly(departureDate);

  if (!departure.ok) {
    return departure;
  }

  const formattedToday = formatDateOnly(localToday);

  if (!formattedToday.ok) {
    return formattedToday;
  }

  const today = parseDateOnly(formattedToday.value);

  if (!today.ok) {
    return today;
  }

  const daysRemaining =
    toUtcDayOrdinal(departure.value) - toUtcDayOrdinal(today.value);

  if (daysRemaining > 0) {
    return {
      ok: true,
      value: {
        status: 'future',
        daysRemaining,
        label: `还有 ${daysRemaining} 天`,
      },
    };
  }

  if (daysRemaining === 0) {
    return {
      ok: true,
      value: { status: 'today', daysRemaining: 0, label: '今天出发' },
    };
  }

  return {
    ok: true,
    value: { status: 'completed', daysRemaining, label: '旅行已结束' },
  };
}
