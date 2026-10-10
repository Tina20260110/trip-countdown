import { Platform } from 'react-native';

import { createChecklistRepository } from '../data/checklist-repository';
import { createDatabaseInitializer } from '../data/database';
import { createExpoSqliteDriver } from '../data/expo-sqlite-adapter';
import { migrateDatabase } from '../data/migrations';
import { createNativePrivateStoragePort } from '../data/native-private-storage';
import { createReminderRepository } from '../data/reminder-repository';
import { createTripRepository } from '../data/trip-repository';
import { createExpoNotificationAdapter } from '../features/reminders/expo-notification-adapter';
import { createReminderCoordinator, createReminderTripQueue } from '../features/reminders/reminder-coordinator';
import { createReminderReconciler } from '../features/reminders/reconciliation';
import type { BootstrapPort } from '../features/bootstrap/types';
import { createTripDeletionPort } from '../features/trips/trip-deletion-port';

const initializer = createDatabaseInitializer({
  privateStorage: createNativePrivateStoragePort(),
  driver: createExpoSqliteDriver(),
  migrate: migrateDatabase,
});

export const productionBootstrap: BootstrapPort = {
  async initialize() {
    const initialized = await initializer.initialize();
    if (!initialized.ok) {
      return { ok: false, error: { message: initialized.error.message } };
    }

    const reminderRepository = createReminderRepository(initialized.value);
    const tripRepository = createTripRepository(initialized.value);
    const notifications = createExpoNotificationAdapter();
    const queue = createReminderTripQueue();
    const reminderCoordinator = createReminderCoordinator({
      repository: reminderRepository,
      notifications,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      queue,
    });
    const reminderReconciler = createReminderReconciler({
      tripRepository,
      reminderRepository,
      notifications,
      coordinator: reminderCoordinator,
    });
    const tripDeletionPort = createTripDeletionPort({
      tripRepository,
      reminderRepository,
      notifications,
      queue,
    });

    // Reconciliation is best-effort recovery. A notification API failure must
    // not block the offline Trip and Checklist experience.
    await reminderReconciler.reconcile().catch(() => undefined);
    return {
      ok: true,
      value: {
        tripRepository,
        checklistRepository: createChecklistRepository(initialized.value),
        reminderRepository,
        reminderCoordinator,
        reminderReconciler,
        tripDeletionPort,
      },
    };
  },
};
