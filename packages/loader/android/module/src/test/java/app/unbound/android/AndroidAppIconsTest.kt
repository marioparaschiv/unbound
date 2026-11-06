package app.unbound.android

import android.content.pm.ApplicationInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.io.FileOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AndroidAppIconsTest {
    @Test
    fun packagedAliasAppearsWithAnInstalledModuleAsset() {
        val root = createRoot()
        val appAPK = File(root, "discord.apk")
        val moduleAPK = File(root, "module.apk")
        writeAPK(appAPK, mapOf("assets/unbound/app-icon.json" to "{\"id\":\"BrandInvertedIcon\"}"))
        writeAPK(moduleAPK, mapOf("assets/unbound-icon.webp" to "icon"))

        val icons = AndroidAppIcons.describe(applicationInfo(moduleAPK, root), applicationInfo(appAPK, root))

        assertEquals(1, icons.length())
        assertEquals("BrandInvertedIcon", icons.getJSONObject(0).getString("id"))
        assertEquals("UnboundIcon", icons.getJSONObject(0).getString("pickerId"))
        assertEquals("Unbound", icons.getJSONObject(0).getString("name"))
        val image = File(java.net.URI(icons.getJSONObject(0).getString("image")))
        assertTrue(image.exists())
        assertEquals("icon", image.readText())
    }

    @Test
    fun anUnpreparedDiscordAPKDoesNotExposeAnIcon() {
        val root = createRoot()
        val appAPK = File(root, "discord.apk")
        val moduleAPK = File(root, "module.apk")
        writeAPK(appAPK, emptyMap())
        writeAPK(moduleAPK, mapOf("assets/unbound-icon.webp" to "icon"))

        val icons = AndroidAppIcons.describe(applicationInfo(moduleAPK, root), applicationInfo(appAPK, root))

        assertEquals(0, icons.length())
        assertFalse(File(root, "files/Unbound/AppIcons/unbound-icon.webp").exists())
    }

    private fun createRoot(): File = kotlin.io.path.createTempDirectory("unbound-app-icons").toFile()

    private fun applicationInfo(apk: File, root: File) = ApplicationInfo().apply {
        sourceDir = apk.absolutePath
        dataDir = root.absolutePath
    }

    private fun writeAPK(path: File, entries: Map<String, String>) {
        ZipOutputStream(FileOutputStream(path)).use { archive ->
            for ((name, value) in entries) {
                archive.putNextEntry(ZipEntry(name))
                archive.write(value.toByteArray())
                archive.closeEntry()
            }
        }
    }
}
