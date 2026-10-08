export type TripId = number;
export type ChecklistItemId = number;

export interface TripInput {
  destination: string;
  departureDate: string;
  notes: string;
}

export type CreateTripInput = TripInput;

export type EditTripInput = TripInput;

export interface Trip extends TripInput {
  id: TripId;
  createdAt: number;
  updatedAt: number;
}

export interface ChecklistProgress {
  completed: number;
  total: number;
}

export interface TripSummary extends Trip {
  checklistProgress: ChecklistProgress;
}

export interface ChecklistItem {
  id: ChecklistItemId;
  tripId: TripId;
  title: string;
  completed: boolean;
  createdAt: number;
}

export type ReminderOffset = 1 | 7;

export type ReminderStatus =
  | 'disabled'
  | 'pending'
  | 'scheduled'
  | 'permission_denied'
  | 'unavailable'
  | 'error';

export interface Reminder {
  tripId: TripId;
  offsetDays: ReminderOffset;
  enabled: boolean;
  status: ReminderStatus;
  revision: number;
  notificationId: string;
  targetDate: string | null;
  scheduledAt: number | null;
  scheduledTimezone: string | null;
  errorCode: string | null;
}

export interface TripDetail extends Trip {
  checklistItems: readonly ChecklistItem[];
  reminders: readonly Reminder[];
}

export interface ChecklistItemInput {
  title: string;
}

export type ValidationField = 'destination' | 'departureDate' | 'notes' | 'title';

export interface ValidationError {
  kind: 'validation';
  fieldErrors: Partial<Record<ValidationField, string>>;
}

export interface NotFoundError {
  kind: 'not-found';
  message: string;
}

export interface StorageError {
  kind: 'storage';
  message: string;
}

export interface PermissionDeniedError {
  kind: 'permission-denied';
  message: string;
}

export interface UnavailableError {
  kind: 'unavailable';
  message: string;
}

export interface SchedulingError {
  kind: 'scheduling';
  message: string;
}

export type DomainError =
  | ValidationError
  | NotFoundError
  | StorageError
  | PermissionDeniedError
  | UnavailableError
  | SchedulingError;

export type Result<T, E = DomainError> =
  | { ok: true; value: T }
  | { ok: false; error: E };
