import type {
  ChecklistRepository,
  ReminderRepository,
  TripRepository,
} from '../../contracts/repositories';
import type { Result } from '../../domain/types';
import type { ReminderCoordinator } from '../reminders/reminder-coordinator';
import type { ReminderReconciler } from '../reminders/reconciliation';
import type { TripDeletionPort } from '../trips/trip-deletion-port';

export interface AppDependencies {
  tripRepository: TripRepository;
  checklistRepository: ChecklistRepository;
  reminderRepository: ReminderRepository;
  reminderCoordinator: ReminderCoordinator;
  reminderReconciler: ReminderReconciler;
  tripDeletionPort: TripDeletionPort;
}

export interface BootstrapError {
  message: string;
}

export interface BootstrapPort {
  initialize(): Promise<Result<AppDependencies, BootstrapError>>;
}

export type BootstrapState =
  | { status: 'initializing' }
  | { status: 'ready'; dependencies: AppDependencies }
  | { status: 'failed' };
