package expo.modules.tripnative

import android.content.Context
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

internal const val PRIVATE_STORAGE_DIRECTORY_NAME = "trip-countdown"

internal class PrivateStorageUnavailableException(cause: Throwable? = null) :
  CodedException("ERR_PRIVATE_STORAGE_UNAVAILABLE", "Private storage is unavailable.", cause)

internal class PrivateStorageVerificationException(cause: Throwable? = null) :
  CodedException("ERR_PRIVATE_STORAGE_VERIFICATION_FAILED", "Private storage verification failed.", cause)

internal object PrivateStoragePreparer {
  fun prepare(noBackupRoot: File): File {
    val root = try {
      noBackupRoot.canonicalFile
    } catch (error: Exception) {
      throw PrivateStorageUnavailableException(error)
    }
    val directory = File(root, PRIVATE_STORAGE_DIRECTORY_NAME)

    try {
      if (directory.exists() && !directory.isDirectory) {
        throw PrivateStorageVerificationException()
      }
      if (!directory.exists() && !directory.mkdirs() && !directory.isDirectory) {
        throw PrivateStorageUnavailableException()
      }

      val canonicalDirectory = directory.canonicalFile
      if (
        canonicalDirectory.parentFile != root ||
        !canonicalDirectory.isDirectory ||
        !canonicalDirectory.canRead() ||
        !canonicalDirectory.canWrite()
      ) {
        throw PrivateStorageVerificationException()
      }
      return canonicalDirectory
    } catch (error: CodedException) {
      throw error
    } catch (error: Exception) {
      throw PrivateStorageUnavailableException(error)
    }
  }
}

class ExpoTripNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ExpoTripNative")

    AsyncFunction("preparePrivateStorage") {
      val directory = PrivateStoragePreparer.prepare(context.noBackupFilesDir)
      mapOf("directory" to directory.absolutePath)
    }
  }
}
