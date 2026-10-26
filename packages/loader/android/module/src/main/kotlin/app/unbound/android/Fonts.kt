package app.unbound.android

import android.content.res.AssetManager
import android.graphics.Typeface
import android.graphics.fonts.Font
import android.os.Build
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ConcurrentHashMap

object Fonts {
    private val FONT_MANAGER = HostClass.legacy("com.facebook.react.common.assets.ReactFontManager")
    private const val TYPEFACE_STYLE = "com.facebook.react.common.assets.ReactFontManager\$TypefaceStyle"
    private const val ASSET_PREFIX = "asset:"
    private val ASSET_FONT = Regex("^fonts/(.+?)(_bold_italic|_bold|_italic)?\\.(ttf|otf)$")

    private val typefaces = ConcurrentHashMap<String, LoadedFont>()
    private val resolving = ThreadLocal<Boolean>()
    private val resolutions = ConcurrentHashMap<String, String>()
    private val pendingFallback = ThreadLocal<Typeface?>()

    fun install(xposed: XposedInterface, classLoader: ClassLoader) {
        SettingsWatcher.onChange { resolutions.clear() }
        val manager = FONT_MANAGER.find(classLoader)
        if (manager == null) {
            hookTypefaces(xposed)
            return
        }
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
                val replacement = resolve(family, chain.getArg(2) as AssetManager) ?: return@intercept chain.proceed()
                apply.invoke(chain.getArg(1), replacement)
            }

        Logger.info(LogCategory.FONTS, "Hooked ReactFontManager.getTypeface.")
    }

    private fun hookTypefaces(xposed: XposedInterface) {
        xposed.hook(Typeface::class.java.getDeclaredMethod("createFromAsset", AssetManager::class.java, String::class.java))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val match = ASSET_FONT.matchEntire(chain.getArg(1) as String) ?: return@intercept chain.proceed()
                val replacement = guarded { resolve(match.groupValues[1], chain.getArg(0) as AssetManager) }
                    ?: return@intercept chain.proceed()
                styled(replacement, assetStyle(match.groupValues[2]))
            }

        xposed.hook(Typeface::class.java.getDeclaredMethod("create", String::class.java, Integer.TYPE))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val family = chain.getArg(0) as? String ?: return@intercept chain.proceed()
                val assets = Platform.application()?.assets ?: return@intercept chain.proceed()
                val replacement = guarded { resolve(family, assets) } ?: return@intercept chain.proceed()
                styled(replacement, chain.getArg(1) as Int)
            }

        hookFontFamilies(xposed)

        Logger.info(LogCategory.FONTS, "React Native's font manager is obfuscated, so fonts are replaced where Android creates typefaces.")
    }

    private fun hookFontFamilies(xposed: XposedInterface) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return

        xposed.hook(Font.Builder::class.java.getDeclaredConstructor(AssetManager::class.java, String::class.java))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val match = ASSET_FONT.matchEntire(chain.getArg(1) as String)
                pendingFallback.set(
                    match?.let { found ->
                        guarded { resolve(found.groupValues[1], chain.getArg(0) as AssetManager) }
                            ?.let { styled(it, assetStyle(found.groupValues[2])) }
                    },
                )
                chain.proceed()
            }

        xposed.hook(Typeface.CustomFallbackBuilder::class.java.getDeclaredMethod("build"))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val replacement = pendingFallback.get()
                pendingFallback.set(null)
                replacement ?: chain.proceed()
            }
    }

    private fun guarded(block: () -> Typeface?): Typeface? {
        if (resolving.get() == true) return null
        resolving.set(true)
        return try {
            block()
        } finally {
            resolving.set(false)
        }
    }

    private fun assetStyle(suffix: String): Int = when (suffix) {
        "_bold" -> Typeface.BOLD
        "_italic" -> Typeface.ITALIC
        "_bold_italic" -> Typeface.BOLD_ITALIC
        else -> Typeface.NORMAL
    }

    private fun styled(typeface: Typeface, style: Int): Typeface =
        if (style == Typeface.NORMAL) typeface else guarded { Typeface.create(typeface, style) } ?: typeface

    private fun resolve(family: String, assets: AssetManager): Typeface? {
        val font = JSONObject(resolutions.getOrPut(family) { NativeBridge.nativeResolveFont(family) })
        val name = font.optString("name").takeIf { it.isNotEmpty() } ?: return null
        val error = font.optString("error").takeIf { it.isNotEmpty() }
        return typefaces.getOrPut(name) { load(name, font.optString("path"), error, assets) }.typeface
    }

    private fun load(name: String, path: String, error: String?, assets: AssetManager): LoadedFont {
        if (error != null) {
            Logger.error(LogCategory.FONTS, error)
            return LoadedFont(null)
        }

        val typeface = if (path.isEmpty()) {
            Typeface.create(name, Typeface.NORMAL)
        } else {
            runCatching {
                if (path.startsWith(ASSET_PREFIX)) {
                    Typeface.createFromAsset(assets, path.removePrefix(ASSET_PREFIX))
                } else {
                    Typeface.createFromFile(File(path))
                }
            }
                .onSuccess { Logger.info(LogCategory.FONTS, "Loaded font: $name.") }
                .onFailure { Logger.error(LogCategory.FONTS, "Failed to load font \"$name\"", it) }
                .getOrNull()
        }
        return LoadedFont(typeface)
    }

    private class LoadedFont(val typeface: Typeface?)
}
