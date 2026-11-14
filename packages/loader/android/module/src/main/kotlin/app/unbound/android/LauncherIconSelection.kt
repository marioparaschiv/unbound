package app.unbound.android

import android.content.Context
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.os.Handler
import android.os.Looper
import android.os.PersistableBundle
import android.widget.Toast
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import org.json.JSONArray
import org.json.JSONObject
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
    private const val ANIMATED_REST_FRAME = "unbound-animated-rest.png"
    private const val UNSUPPORTED_LAUNCHER_PINNED =
        "Your launcher can't change Discord's icon, so Unbound added a Home Screen shortcut with it instead."
    private const val UNSUPPORTED_LAUNCHER = "Your launcher can't change Discord's icon, and Unbound couldn't add a shortcut with it."

    @Volatile private var moduleAPK: String? = null

    fun install(xposed: XposedInterface, classLoader: ClassLoader) {
        moduleAPK = runCatching { xposed.moduleApplicationInfo.sourceDir }.getOrNull()
        val module = classLoader.loadClass(APP_ICON_MODULE)
        val promise = classLoader.loadClass(REACT_PROMISE)
        val resolve = promise.getMethod("resolve", Any::class.java)
        val createMap = classLoader.loadClass(REACT_ARGUMENTS).getMethod("createMap")

        xposed.hook(module.getDeclaredMethod("setIcon", String::class.java, promise))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val id = chain.getArg(0) as? String
                if (id?.startsWith(CUSTOM_PREFIX) == true || id == AnimatedIconFrames.ID) {
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
        iconImage(id) != null
    }

    private fun iconImage(id: String): File? = if (id == AnimatedIconFrames.ID) animatedRestFrame() else customIconFile(id)

    private fun animatedRestFrame(): File? = moduleAPK?.let { apk ->
        runCatching { AnimatedIconFrames.extractRestFrame(apk, File(iconDirectory(), ANIMATED_REST_FRAME)) }.getOrNull()
    }

    private fun select(id: String) {
        val context = ActivityTracker.application() ?: return
        val image = iconImage(id)
        val icon = image?.let(AdaptiveIcon::fromFile)
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (icon == null || launch == null) {
            Logger.error(LogCategory.DEFAULT, "Failed to read custom launcher icon $id")
            return
        }
        val extras = PersistableBundle().apply { putBoolean(AnimatedIconFrames.EXTRA, id == AnimatedIconFrames.ID) }
        val shortcut = ShortcutInfo.Builder(context, SHORTCUT_ID)
            .setShortLabel("Discord")
            .setIcon(icon)
            .setIntent(launch)
            .setExtras(extras)
            .build()
        runCatching { shortcuts(context)?.addDynamicShortcuts(listOf(shortcut)) }
            .onSuccess { selectionFile().writeText(id) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to publish custom launcher icon $id", it) }
        if (!LauncherPackages.drawsCustomIcons(context)) pinInstead(context, id, image)
    }

    private fun pinInstead(context: Context, id: String, image: File) {
        val name = customIconName(id) ?: "Discord"
        val pinned = HomeScreenShortcuts.pin(name, image.absolutePath)
        Logger.info(
            LogCategory.DEFAULT,
            "Launcher ${LauncherPackages.defaultLauncher(context)} can't draw custom icons; pinned $id: $pinned",
        )
        Handler(Looper.getMainLooper()).post {
            val message = if (pinned) UNSUPPORTED_LAUNCHER_PINNED else UNSUPPORTED_LAUNCHER
            Toast.makeText(context, message, Toast.LENGTH_LONG).show()
        }
    }

    private fun customIconName(id: String): String? =
        if (id == AnimatedIconFrames.ID) AnimatedIconFrames.NAME else manifestEntry(id)?.optString("name")?.takeIf { it.isNotEmpty() }

    private fun clear() {
        val context = ActivityTracker.application() ?: return
        selectionFile().delete()
        runCatching { shortcuts(context)?.removeDynamicShortcuts(listOf(SHORTCUT_ID)) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to remove the custom launcher icon", it) }
    }

    private fun manifestEntry(id: String): JSONObject? {
        val manifest = File(iconDirectory(), MANIFEST).takeIf { it.isFile } ?: return null
        val entries = runCatching { JSONArray(manifest.readText()) }.getOrNull() ?: return null
        return (0 until entries.length()).map(entries::getJSONObject).firstOrNull { it.optString("id") == id }
    }

    private fun customIconFile(id: String): File? {
        val file = manifestEntry(id)?.optString("file")?.takeIf { it.isNotEmpty() } ?: return null
        return File(iconDirectory(), file).canonicalFile.takeIf { it.parentFile == iconDirectory().canonicalFile && it.isFile }
    }

    private fun shortcuts(context: Context): ShortcutManager? = context.getSystemService(ShortcutManager::class.java)

    private fun iconDirectory(): File = File(NativeBridge.documents, ICON_DIRECTORY)

    private fun selectionFile(): File = File(iconDirectory(), SELECTION)
}
