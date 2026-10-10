import Foundation
import XCTest
@testable import ExpoTripNative

final class PrivateStoragePreparerTests: XCTestCase {
  private var root: URL!

  override func setUpWithError() throws {
    root = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString, isDirectory: true)
    try FileManager.default.createDirectory(
      at: root,
      withIntermediateDirectories: true
    )
  }

  override func tearDownWithError() throws {
    try? FileManager.default.removeItem(at: root)
  }

  func testRepeatedPreparationMaintainsDirectoryExclusion() throws {
    let first = try PrivateStoragePreparer.prepare(
      applicationSupport: root,
      fileManager: .default
    )
    var values = URLResourceValues()
    values.isExcludedFromBackup = false
    var mutableFirst = first
    try mutableFirst.setResourceValues(values)

    let second = try PrivateStoragePreparer.prepare(
      applicationSupport: root,
      fileManager: .default
    )

    XCTAssertEqual(first, second)
    XCTAssertEqual(
      try second.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup,
      true
    )
  }

  func testRestoresExclusionForExistingDatabaseAndSidecars() throws {
    let directory = try PrivateStoragePreparer.prepare(
      applicationSupport: root,
      fileManager: .default
    )
    let names = [
      privateStorageDatabaseName,
      "\(privateStorageDatabaseName)-wal",
      "\(privateStorageDatabaseName)-shm",
      "\(privateStorageDatabaseName)-journal"
    ]
    var values = URLResourceValues()
    values.isExcludedFromBackup = false
    for name in names {
      let file = directory.appendingPathComponent(name)
      FileManager.default.createFile(atPath: file.path, contents: Data())
      var mutableFile = file
      try mutableFile.setResourceValues(values)
    }

    _ = try PrivateStoragePreparer.prepare(
      applicationSupport: root,
      fileManager: .default
    )

    for name in names {
      let file = directory.appendingPathComponent(name)
      XCTAssertEqual(
        try file.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup,
        true
      )
    }
  }

  func testRejectsFileAtPrivateDirectoryPath() throws {
    let invalid = root.appendingPathComponent(privateStorageDirectoryName)
    FileManager.default.createFile(atPath: invalid.path, contents: Data())

    XCTAssertThrowsError(
      try PrivateStoragePreparer.prepare(
        applicationSupport: root,
        fileManager: .default
      )
    )
  }
}
