import type { BootstrapPort } from '../features/bootstrap/types';
import { createChecklistRepository } from '../data/checklist-repository';
import { createDatabaseInitializer } from '../data/database';
import { storageError } from '../data/errors';
import { createExpoSqliteDriver } from '../data/expo-sqlite-adapter';
import { migrateDatabase } from '../data/migrations';
import type { PreparePrivateStoragePort } from '../data/private-storage';
import { createReminderRepository } from '../data/reminder-repository';
import { createTripRepository } from '../data/trip-repository';

const unavailablePrivateStorage: PreparePrivateStoragePort = {
  async preparePrivateStorage() {
    return {
      ok: false,
      error: storageError('private-storage-unavailable'),
    };
  },
};

const initializer = createDatabaseInitializer({
  privateStorage: unavailablePrivateStorage,
  driver: createExpoSqliteDriver(),
  migrate: migrateDatabase,
});

export const productionBootstrap: BootstrapPort = {
  async initialize() {
    const initialized = await initializer.initialize();
    if (!initialized.ok) {
      return { ok: false, error: { message: initialized.error.message } };
    }

    return {
      ok: true,
      value: {
        tripRepository: createTripRepository(initialized.value),
        checklistRepository: createChecklistRepository(initialized.value),
        reminderRepository: createReminderRepository(initialized.value),
      },
    };
  },
};
