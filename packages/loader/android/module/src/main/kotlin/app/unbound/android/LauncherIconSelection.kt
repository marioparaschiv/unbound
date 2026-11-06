package app.unbound.android

import android.content.Context
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import org.json.JSONArray
import java.io.File

internal object LauncherIconSelection {
    const val SHORTCUT_ID = "unbound-launcher-icon"
    private const val APP_ICON_MODULE = "com.discord.app_icon.AppIconModule"
    private const val REACT_PROMISE = "com.facebook.react.bridge.Promise"
    private const val REACT_ARGUMENTS = "com.facebook.react.bridge.Arguments"
    private const val CUSTOM_PREFIX = "UnboundCustom"
    private const val ICON_DIRECTORY = "AppIcons"
    private const val MANIFEST = "custom.json"
    private const val SELECTION = "launcher-icon"

    fun install(xposed: XposedInterface, classLoader: ClassLoader) {
        val module = classLoader.loadClass(APP_ICON_MODULE)
        val promise = classLoader.loadClass(REACT_PROMISE)
        val resolve = promise.getMethod("resolve", Any::class.java)
        val createMap = classLoader.loadClass(REACT_ARGUMENTS).getMethod("createMap")

        xposed.hook(module.getDeclaredMethod("setIcon", String::class.java, promise))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val id = chain.getArg(0) as? String
                if (id?.startsWith(CUSTOM_PREFIX) == true) {
                    select(id)
                    resolve.invoke(chain.getArg(1), null)
                    null
                } else {
                    clear()
                    chain.proceed()
                }
            }

        xposed.hook(module.getDeclaredMethod("getCurrentIcon", promise))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val selected = selectedId()
                if (selected == null) {
                    chain.proceed()
                } else {
                    val map = createMap.invoke(null)
                    map.javaClass.getMethod("putString", String::class.java, String::class.java)
                        .invoke(map, "id", selected)
                    resolve.invoke(chain.getArg(0), map)
                    null
                }
            }
    }

    fun selectedId(): String? = selectionFile().takeIf { it.isFile }?.readText()?.trim()?.takeIf { id ->
        customIconFile(id) != null
    }

    private fun select(id: String) {
        val context = ActivityTracker.application() ?: return
        val image = customIconFile(id)
        val icon = image?.let(AdaptiveIcon::fromFile)
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (icon == null || launch == null) {
            Logger.error(LogCategory.DEFAULT, "Failed to read custom launcher icon $id")
            return
        }
        val shortcut = ShortcutInfo.Builder(context, SHORTCUT_ID)
            .setShortLabel("Discord")
            .setIcon(icon)
            .setIntent(launch)
            .build()
        runCatching { shortcuts(context)?.addDynamicShortcuts(listOf(shortcut)) }
            .onSuccess { selectionFile().writeText(id) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to publish custom launcher icon $id", it) }
    }

    private fun clear() {
        val context = ActivityTracker.application() ?: return
        selectionFile().delete()
        runCatching { shortcuts(context)?.removeDynamicShortcuts(listOf(SHORTCUT_ID)) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to remove the custom launcher icon", it) }
    }

    private fun customIconFile(id: String): File? {
        val manifest = File(iconDirectory(), MANIFEST).takeIf { it.isFile } ?: return null
        val entries = runCatching { JSONArray(manifest.readText()) }.getOrNull() ?: return null
        val entry = (0 until entries.length()).map(entries::getJSONObject).firstOrNull { it.optString("id") == id }
        val file = entry?.optString("file")?.takeIf { it.isNotEmpty() } ?: return null
        return File(iconDirectory(), file).canonicalFile.takeIf { it.parentFile == iconDirectory().canonicalFile && it.isFile }
    }

    private fun shortcuts(context: Context): ShortcutManager? = context.getSystemService(ShortcutManager::class.java)

    private fun iconDirectory(): File = File(NativeBridge.documents, ICON_DIRECTORY)

    private fun selectionFile(): File = File(iconDirectory(), SELECTION)
}
