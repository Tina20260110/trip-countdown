package expo.modules.tripnative

import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class PrivateStoragePreparerTest {
  private lateinit var root: File

  @Before
  fun setUp() {
    root = Files.createTempDirectory("trip-native-no-backup").toFile()
  }

  @After
  fun tearDown() {
    root.deleteRecursively()
  }

  @Test
  fun createsFixedDirectoryUnderNoBackupRoot() {
    val directory = PrivateStoragePreparer.prepare(root)

    assertEquals(root.canonicalFile, directory.parentFile)
    assertEquals(PRIVATE_STORAGE_DIRECTORY_NAME, directory.name)
    assertTrue(directory.isDirectory)
  }

  @Test
  fun repeatedPreparationReturnsSameDirectory() {
    val first = PrivateStoragePreparer.prepare(root)
    val second = PrivateStoragePreparer.prepare(root)

    assertEquals(first, second)
  }

  @Test(expected = PrivateStorageVerificationException::class)
  fun rejectsFileAtPrivateDirectoryPath() {
    File(root, PRIVATE_STORAGE_DIRECTORY_NAME).writeText("not a directory")

    PrivateStoragePreparer.prepare(root)
  }
}
