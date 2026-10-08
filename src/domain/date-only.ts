import type { Result } from './types';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_CALENDAR_DAY = 86_400_000;

declare const dateOnlyBrand: unique symbol;

export type DateOnly = string & { readonly [dateOnlyBrand]: true };

export interface DateOnlyComponents {
  year: number;
  month: number;
  day: number;
}

export interface ParsedDateOnly extends DateOnlyComponents {
  value: DateOnly;
}

export interface InvalidDateOnlyError {
  kind: 'invalid-date-only';
  value: string;
}

function createUtcCalendarDate({ year, month, day }: DateOnlyComponents): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function hasValidCalendarComponents(components: DateOnlyComponents): boolean {
  const { year, month, day } = components;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 0 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const candidate = createUtcCalendarDate(components);

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function serializeComponents({ year, month, day }: DateOnlyComponents): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatDateOnly(
  components: DateOnlyComponents,
): Result<DateOnly, InvalidDateOnlyError> {
  const value = serializeComponents(components);

  return hasValidCalendarComponents(components)
    ? { ok: true, value: value as DateOnly }
    : { ok: false, error: { kind: 'invalid-date-only', value } };
}

export function parseDateOnly(
  value: string,
): Result<ParsedDateOnly, InvalidDateOnlyError> {
  const match = DATE_ONLY_PATTERN.exec(value);

  if (!match) {
    return { ok: false, error: { kind: 'invalid-date-only', value } };
  }

  const components: DateOnlyComponents = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const formatted = formatDateOnly(components);

  if (!formatted.ok || formatted.value !== value) {
    return { ok: false, error: { kind: 'invalid-date-only', value } };
  }

  return { ok: true, value: { value: formatted.value, ...components } };
}

export function getLocalDateOnly(date: Date = new Date()): ParsedDateOnly {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Cannot read calendar components from an invalid Date');
  }

  const components: DateOnlyComponents = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
  const formatted = formatDateOnly(components);

  if (!formatted.ok) {
    throw new RangeError('Local calendar components are outside the supported range');
  }

  return { value: formatted.value, ...components };
}

export function toUtcDayOrdinal(date: ParsedDateOnly): number {
  return createUtcCalendarDate(date).getTime() / MILLISECONDS_PER_CALENDAR_DAY;
}
