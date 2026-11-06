package app.unbound.android

import android.content.Context
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Rect
import android.graphics.drawable.Icon
import java.io.File
import java.util.UUID

internal object HomeScreenShortcuts {
    private const val ICON_DIRECTORY = "AppIcons"
    private const val MAX_NAME_LENGTH = 32
    private const val ADAPTIVE_ICON_SIZE = 432

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
        val bitmap = BitmapFactory.decodeFile(image.path) ?: return false
        val shortcut = ShortcutInfo.Builder(context, "unbound-icon-${UUID.randomUUID()}")
            .setShortLabel(name)
            .setIcon(Icon.createWithAdaptiveBitmap(adaptiveBitmap(bitmap)))
            .setIntent(launch)
            .build()
        return shortcuts.requestPinShortcut(shortcut, null)
    }

    private fun adaptiveBitmap(source: Bitmap): Bitmap {
        val canvas = Bitmap.createBitmap(ADAPTIVE_ICON_SIZE, ADAPTIVE_ICON_SIZE, Bitmap.Config.ARGB_8888)
        val scale = maxOf(ADAPTIVE_ICON_SIZE.toFloat() / source.width, ADAPTIVE_ICON_SIZE.toFloat() / source.height)
        val width = (source.width * scale).toInt()
        val height = (source.height * scale).toInt()
        val left = (ADAPTIVE_ICON_SIZE - width) / 2
        val top = (ADAPTIVE_ICON_SIZE - height) / 2
        Canvas(canvas).drawBitmap(source, null, Rect(left, top, left + width, top + height), null)
        return canvas
    }
}
