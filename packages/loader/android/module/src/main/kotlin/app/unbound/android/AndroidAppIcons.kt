package app.unbound.android

import android.content.pm.ApplicationInfo
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.zip.ZipFile

internal object AndroidAppIcons {
    const val MARKER = "assets/unbound/app-icon.json"
    private const val ICON_ASSET = "assets/unbound-icon.webp"
    private const val ICON_ID = "BrandInvertedIcon"
    private const val PICKER_ID = "UnboundIcon"
    private const val ICON_DESTINATION = "Unbound/AppIcons/unbound-icon.webp"
    private const val ICON_INSTALLED = "appIconInstalled"

    /**
     * [packaged] says whether Discord's APK carries the icon marker, when the caller already knows; [cache] skips
     * copying an icon this module version already installed.
     */
    fun describe(
        moduleInfo: ApplicationInfo,
        appInfo: ApplicationInfo,
        packaged: Boolean? = null,
        cache: StartupCache? = null,
    ): JSONArray = try {
        if (!(packaged ?: hasPackagedIcon(appInfo.sourceDir))) return JSONArray()

        val image = File(appInfo.dataDir, "files/$ICON_DESTINATION")
        val moduleAPK = File(moduleInfo.sourceDir)
        if (!image.isFile || cache?.get(ICON_INSTALLED, moduleAPK) == null) {
            installIcon(moduleInfo.sourceDir, image)
            cache?.put(ICON_INSTALLED, moduleAPK, "1")
        }

        JSONArray().put(
            JSONObject()
                .put("id", ICON_ID)
                .put("pickerId", PICKER_ID)
                .put("name", "Unbound")
                .put("image", Uri.fromFile(image).toString()),
        )
    } catch (error: Exception) {
        Logger.error(LogCategory.DEFAULT, "Failed to load the packaged Unbound app icon", error)
        JSONArray()
    }

    private fun hasPackagedIcon(apkPath: String): Boolean = ZipFile(apkPath).use { archive ->
        archive.getEntry(MARKER) != null
    }

    private fun installIcon(moduleAPK: String, destination: File) {
        destination.parentFile?.mkdirs()

        ZipFile(moduleAPK).use { archive ->
            val asset = archive.getEntry(ICON_ASSET)
                ?: throw IllegalStateException("The Android module has no Unbound app icon asset")
            archive.getInputStream(asset).use { input ->
                destination.outputStream().use { output -> input.copyTo(output) }
            }
        }
    }
}
