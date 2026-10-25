package app.unbound.android

import android.content.res.AssetManager
import android.graphics.Typeface
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import org.json.JSONArray
import java.io.File
import java.util.concurrent.ConcurrentHashMap

object Fonts {
    private const val FONT_MANAGER = "com.facebook.react.common.assets.ReactFontManager"
    private const val TYPEFACE_STYLE = "com.facebook.react.common.assets.ReactFontManager\$TypefaceStyle"
    private const val DEFAULT_FAMILY = "sans-serif"

    private val typefaces = ConcurrentHashMap<String, Typeface>()

    fun install(xposed: XposedInterface, classLoader: ClassLoader) {
        val manager = classLoader.loadClass(FONT_MANAGER)
        val style = classLoader.loadClass(TYPEFACE_STYLE)
        val getTypeface = manager.getDeclaredMethod(
            "getTypeface",
            String::class.java,
            style,
            AssetManager::class.java,
        )
        val apply = style.getDeclaredMethod("apply", Typeface::class.java).apply { isAccessible = true }

        xposed.hook(getTypeface)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val family = chain.getArg(0) as String
                val replacement = resolve(family) ?: return@intercept chain.proceed()
                apply.invoke(chain.getArg(1), replacement)
            }

        Logger.info("fonts", "Hooked ReactFontManager.getTypeface.")
    }

    private fun resolve(family: String): Typeface? {
        val target = NativeBridge.nativePreference("font-override", family).orEmpty()
        if (target.isEmpty() || target == family) return null

        return typefaces.getOrPut(target) { load(target) ?: return null }
    }

    private fun load(name: String): Typeface? {
        val fonts = runCatching { JSONArray(NativeBridge.nativeFontsJSON()) }.getOrNull()
        val custom = (0 until (fonts?.length() ?: 0))
            .map { fonts!!.getJSONObject(it) }
            .firstOrNull { it.optString("name") == name }

        if (custom != null) {
            val file = File(custom.optString("path"))
            return runCatching { Typeface.createFromFile(file) }
                .onSuccess { Logger.info("fonts", "Loaded font: $name.") }
                .onFailure { Logger.error("fonts", "Failed to load font \"$name\"", it) }
                .getOrNull()
        }

        val system = Typeface.create(name, Typeface.NORMAL)
        if (system == Typeface.DEFAULT && name != DEFAULT_FAMILY) {
            Logger.error("fonts", "Failed to replace a font with \"$name\". The requested font isn't loaded.")
            return null
        }
        return system
    }
}
