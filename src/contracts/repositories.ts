import type {
  ChecklistItem,
  ChecklistItemInput,
  CreateTripInput,
  EditTripInput,
  Reminder,
  ReminderOffset,
  Trip,
  TripDetail,
  TripSummary,
} from '../domain/types';
import type { RepositoryResult } from './repository-result';

export interface TripRepository {
  list(localToday: string): Promise<RepositoryResult<readonly TripSummary[]>>;
  get(id: number): Promise<RepositoryResult<TripDetail>>;
  create(input: CreateTripInput, localToday: string): Promise<RepositoryResult<Trip>>;
  update(id: number, input: EditTripInput): Promise<RepositoryResult<Trip>>;
  delete(id: number): Promise<RepositoryResult<void>>;
}

export interface ChecklistRepository {
  list(tripId: number): Promise<RepositoryResult<readonly ChecklistItem[]>>;
  add(
    tripId: number,
    input: ChecklistItemInput,
  ): Promise<RepositoryResult<ChecklistItem>>;
  setCompleted(
    itemId: number,
    completed: boolean,
  ): Promise<RepositoryResult<ChecklistItem>>;
  remove(itemId: number): Promise<RepositoryResult<void>>;
}

export interface ReminderRepository {
  list(tripId: number): Promise<RepositoryResult<readonly Reminder[]>>;
  get(
    tripId: number,
    offsetDays: ReminderOffset,
  ): Promise<RepositoryResult<Reminder>>;
  create(reminder: Reminder): Promise<RepositoryResult<Reminder>>;
  updateIfRevision(
    expectedRevision: number,
    reminder: Reminder,
  ): Promise<RepositoryResult<Reminder>>;
}
