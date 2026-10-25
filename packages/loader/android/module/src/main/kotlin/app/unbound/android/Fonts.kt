package app.unbound.android

import android.content.res.AssetManager
import android.graphics.Typeface
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ConcurrentHashMap

object Fonts {
    private const val FONT_MANAGER = "com.facebook.react.common.assets.ReactFontManager"
    private const val TYPEFACE_STYLE = "com.facebook.react.common.assets.ReactFontManager\$TypefaceStyle"

    private val typefaces = ConcurrentHashMap<String, LoadedFont>()

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
        val font = JSONObject(NativeBridge.nativeResolveFont(family))
        val name = font.optString("name").takeIf { it.isNotEmpty() } ?: return null
        val error = font.optString("error").takeIf { it.isNotEmpty() }
        return typefaces.getOrPut(name) { load(name, font.optString("path"), error) }.typeface
    }

    private fun load(name: String, path: String, error: String?): LoadedFont {
        if (error != null) {
            Logger.error("fonts", error)
            return LoadedFont(null)
        }

        val typeface = if (path.isEmpty()) {
            Typeface.create(name, Typeface.NORMAL)
        } else {
            runCatching { Typeface.createFromFile(File(path)) }
                .onSuccess { Logger.info("fonts", "Loaded font: $name.") }
                .onFailure { Logger.error("fonts", "Failed to load font \"$name\"", it) }
                .getOrNull()
        }
        return LoadedFont(typeface)
    }

    private class LoadedFont(val typeface: Typeface?)
}
