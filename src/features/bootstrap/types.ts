import type {
  ChecklistRepository,
  ReminderRepository,
  TripRepository,
} from '../../contracts/repositories';
import type { Result } from '../../domain/types';

export interface AppDependencies {
  tripRepository: TripRepository;
  checklistRepository: ChecklistRepository;
  reminderRepository: ReminderRepository;
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
