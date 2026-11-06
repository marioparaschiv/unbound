package app.unbound.android

import android.content.pm.ApplicationInfo
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.zip.ZipFile

internal object AndroidAppIcons {
    private const val MARKER = "assets/unbound/app-icon.json"
    private const val ICON_ASSET = "assets/unbound-icon.webp"
    private const val ICON_ID = "BrandInvertedIcon"
    private const val PICKER_ID = "UnboundIcon"
    private const val ICON_DESTINATION = "Unbound/AppIcons/unbound-icon.webp"

    fun describe(moduleInfo: ApplicationInfo, appInfo: ApplicationInfo): JSONArray = try {
        if (!hasPackagedIcon(appInfo.sourceDir)) return JSONArray()

        val image = installIcon(moduleInfo.sourceDir, appInfo.dataDir)

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

    private fun installIcon(moduleAPK: String, dataDirectory: String): File {
        val destination = File(dataDirectory, "files/$ICON_DESTINATION")
        destination.parentFile?.mkdirs()

        ZipFile(moduleAPK).use { archive ->
            val asset = archive.getEntry(ICON_ASSET)
                ?: throw IllegalStateException("The Android module has no Unbound app icon asset")
            archive.getInputStream(asset).use { input ->
                destination.outputStream().use { output -> input.copyTo(output) }
            }
        }

        return destination
    }
}
