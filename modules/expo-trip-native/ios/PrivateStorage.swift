import Foundation
import ExpoModulesCore

internal let privateStorageDirectoryName = "TripCountdown"
internal let privateStorageDatabaseName = "trip-countdown.db"

internal final class PrivateStorageUnavailableException: Exception {
  override var code: String { "ERR_PRIVATE_STORAGE_UNAVAILABLE" }
  override var reason: String { "Private storage is unavailable." }
}

internal final class PrivateStorageVerificationException: Exception {
  override var code: String { "ERR_PRIVATE_STORAGE_VERIFICATION_FAILED" }
  override var reason: String { "Private storage verification failed." }
}

internal enum PrivateStoragePreparer {
  private static let databaseFileNames = [
    privateStorageDatabaseName,
    "\(privateStorageDatabaseName)-wal",
    "\(privateStorageDatabaseName)-shm",
    "\(privateStorageDatabaseName)-journal"
  ]

  static func prepare(
    applicationSupport: URL,
    fileManager: FileManager
  ) throws -> URL {
    let supportDirectory = applicationSupport.standardizedFileURL
    let directory = supportDirectory
      .appendingPathComponent(privateStorageDirectoryName, isDirectory: true)

    do {
      try fileManager.createDirectory(
        at: directory,
        withIntermediateDirectories: true
      )
    } catch {
      throw PrivateStorageUnavailableException().causedBy(error)
    }

    let resolvedSupport = supportDirectory.resolvingSymlinksInPath()
    let resolvedDirectory = directory.resolvingSymlinksInPath()
    guard resolvedDirectory.deletingLastPathComponent() == resolvedSupport else {
      throw PrivateStorageVerificationException()
    }

    try excludeFromBackupAndVerify(resolvedDirectory)
    for fileName in databaseFileNames {
      let file = resolvedDirectory.appendingPathComponent(fileName)
      if fileManager.fileExists(atPath: file.path) {
        try excludeFromBackupAndVerify(file)
      }
    }
    return resolvedDirectory
  }

  private static func excludeFromBackupAndVerify(_ url: URL) throws {
    do {
      var mutableURL = url
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try mutableURL.setResourceValues(values)

      let verified = try mutableURL.resourceValues(
        forKeys: [.isExcludedFromBackupKey]
      ).isExcludedFromBackup
      guard verified == true else {
        throw PrivateStorageVerificationException()
      }
    } catch let error as Exception {
      throw error
    } catch {
      throw PrivateStorageVerificationException().causedBy(error)
    }
  }
}
