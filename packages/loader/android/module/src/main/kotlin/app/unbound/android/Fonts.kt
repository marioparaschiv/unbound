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

    internal data class AssetFont(val family: String, val style: Int)

    internal sealed interface Source {
        data class System(val name: String) : Source

        data class Asset(val path: String) : Source

        data class File(val path: String) : Source

        data class Failed(val error: String) : Source
    }

    internal fun assetFont(path: String): AssetFont? =
        ASSET_FONT.matchEntire(path)?.let { AssetFont(it.groupValues[1], assetStyle(it.groupValues[2])) }

    internal fun replacement(name: String, path: String, error: String): Source? = when {
        name.isEmpty() -> null
        error.isNotEmpty() -> Source.Failed(error)
        path.isEmpty() -> Source.System(name)
        path.startsWith(ASSET_PREFIX) -> Source.Asset(path.removePrefix(ASSET_PREFIX))
        else -> Source.File(path)
    }

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
                val font = assetFont(chain.getArg(1) as String) ?: return@intercept chain.proceed()
                val replacement = guarded { resolve(font.family, chain.getArg(0) as AssetManager) }
                    ?: return@intercept chain.proceed()
                styled(replacement, font.style)
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
                val font = assetFont(chain.getArg(1) as String)
                pendingFallback.set(
                    font?.let { found ->
                        guarded { resolve(found.family, chain.getArg(0) as AssetManager) }?.let { styled(it, found.style) }
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

    internal fun assetStyle(suffix: String): Int = when (suffix) {
        "_bold" -> Typeface.BOLD
        "_italic" -> Typeface.ITALIC
        "_bold_italic" -> Typeface.BOLD_ITALIC
        else -> Typeface.NORMAL
    }

    private fun styled(typeface: Typeface, style: Int): Typeface =
        if (style == Typeface.NORMAL) typeface else guarded { Typeface.create(typeface, style) } ?: typeface

    private fun resolve(family: String, assets: AssetManager): Typeface? {
        val font = JSONObject(resolutions.getOrPut(family) { NativeBridge.nativeResolveFont(family) })
        val name = font.optString("name")
        val source = replacement(name, font.optString("path"), font.optString("error")) ?: return null
        return typefaces.getOrPut(name) { load(name, source, assets) }.typeface
    }

    private fun load(name: String, source: Source, assets: AssetManager): LoadedFont {
        val typeface = when (source) {
            is Source.Failed -> {
                Logger.error(LogCategory.FONTS, source.error)
                null
            }

            is Source.System -> Typeface.create(source.name, Typeface.NORMAL)

            is Source.Asset -> loadFile(name) { Typeface.createFromAsset(assets, source.path) }

            is Source.File -> loadFile(name) { Typeface.createFromFile(File(source.path)) }
        }
        return LoadedFont(typeface)
    }

    private fun loadFile(name: String, create: () -> Typeface): Typeface? = runCatching(create)
        .onSuccess { Logger.info(LogCategory.FONTS, "Loaded font: $name.") }
        .onFailure { Logger.error(LogCategory.FONTS, "Failed to load font \"$name\"", it) }
        .getOrNull()

    private class LoadedFont(val typeface: Typeface?)
}
