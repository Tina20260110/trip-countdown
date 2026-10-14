import Foundation
import ExpoModulesCore

public class ExpoTripNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoTripNative")

    AsyncFunction("preparePrivateStorage") { () -> [String: String] in
      guard let applicationSupport = FileManager.default.urls(
        for: .applicationSupportDirectory,
        in: .userDomainMask
      ).first else {
        throw PrivateStorageUnavailableException()
      }

      let directory = try PrivateStoragePreparer.prepare(
        applicationSupport: applicationSupport,
        fileManager: .default
      )
      // expo-sqlite SDK 57 parses the directory with URL(string:), so return a
      // file URL to preserve spaces such as "Application Support".
      return ["directory": directory.absoluteString]
    }
  }
}
