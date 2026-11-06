package app.unbound.android

import android.content.Context
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import java.io.File
import java.util.UUID

internal object HomeScreenShortcuts {
    private const val ICON_DIRECTORY = "AppIcons"
    private const val MAX_NAME_LENGTH = 32

    fun pin(name: String, imagePath: String): Boolean = try {
        val context = ActivityTracker.currentActivity() ?: ActivityTracker.application()
        val image = iconFile(imagePath)
        when {
            context == null -> false
            name.isEmpty() || name.length > MAX_NAME_LENGTH -> false
            image == null -> false
            else -> requestPin(context, name, image)
        }
    } catch (error: Exception) {
        Logger.error(LogCategory.DEFAULT, "Failed to pin Home Screen shortcut $name", error)
        false
    }

    private fun iconFile(imagePath: String): File? {
        val root = File(NativeBridge.documents, ICON_DIRECTORY).canonicalFile
        val image = File(imagePath).canonicalFile
        return image.takeIf { it.parentFile == root && it.isFile }
    }

    private fun requestPin(context: Context, name: String, image: File): Boolean {
        val shortcuts = context.getSystemService(ShortcutManager::class.java) ?: return false
        if (!shortcuts.isRequestPinShortcutSupported) return false
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return false
        val icon = AdaptiveIcon.fromFile(image) ?: return false
        val shortcut = ShortcutInfo.Builder(context, "unbound-icon-${UUID.randomUUID()}")
            .setShortLabel(name)
            .setIcon(icon)
            .setIntent(launch)
            .build()
        return shortcuts.requestPinShortcut(shortcut, null)
    }
}
