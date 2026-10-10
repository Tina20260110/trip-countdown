# Private storage and backup device contract

These checks require an Expo SDK 57 development build generated through CNG. Jest and
prebuild output do not prove OS backup behavior.

## Android

1. Generate/build the development variant through the project build workflow.
2. Locate the variant's **merged** manifest and generated backup XML resources.
3. Run:

   ```sh
   node scripts/verify-android-artifact.mjs \
     <merged-AndroidManifest.xml> \
     <backup_rules.xml> \
     <data_extraction_rules.xml>
   ```

4. On a device, confirm `preparePrivateStorage()` returns the fixed child of
   `Context.noBackupFilesDir`, then create/reopen the SQLite database and confirm its
   main file and WAL/SHM sidecars remain in that directory.
5. Exercise platform backup/restore and device transfer. Confirm Trip, Checklist and
   Reminder business data are absent after restore/transfer. Record the OS and OEM.

The verifier rejects exact-alarm and unrelated location, camera, microphone, contacts,
calendar, media and phone permissions. Source/prebuild checks remain distinct from the
merged artifact result.

## iOS

1. Build the generated workspace and run `PrivateStoragePreparerTests` on an iOS
   development destination. These native tests cover repeated initialization and
   restoring removed exclusion attributes for the DB, WAL, SHM and journal files.
2. Launch the development build, initialize storage, enable WAL and fully close/reopen
   the database.
3. Inspect the returned directory and resource values from the native debugger/test:
   - the parent is the app's Application Support directory;
   - the directory is not Caches, tmp, or the default SQLite directory;
   - `isExcludedFromBackup == true` for the directory and every existing
     `trip-countdown.db`, `-wal`, `-shm`, and `-journal` file.
4. Remove an exclusion attribute in the test fixture, restart initialization, and
   confirm it is restored before Bootstrap becomes ready.
5. Perform an encrypted device backup/restore on a real iPhone and confirm business data
   is not restored. Simulator or XCTest evidence does not replace this final check.

## Current evidence

- CNG/prebuild structure and JS contract tests: automated.
- Kotlin/Swift source and native test entry: implemented.
- Android merged development artifact: **PENDING** until a Development Build exists.
- Android device backup/transfer: **PENDING**.
- iOS native tests and development-build resource-value readback: **PENDING**.
- iPhone backup/restore: **PENDING**.
