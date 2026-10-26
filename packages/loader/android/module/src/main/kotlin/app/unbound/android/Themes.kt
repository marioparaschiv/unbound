package app.unbound.android

import android.content.Context
import android.content.res.ColorStateList
import android.content.res.Resources
import android.content.res.TypedArray
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import org.json.JSONObject
import java.lang.reflect.Field
import java.lang.reflect.Method
import java.lang.reflect.Modifier
import java.lang.reflect.Proxy
import java.util.Collections
import java.util.WeakHashMap

object Themes {
    private val THEME_MANAGER = HostClass.legacy("com.discord.theme.ThemeManager")
    private val THEME_TYPE = HostClass.legacy("com.discord.theme.DiscordTheme")
    private val THEME_OBJECT = HostClass.legacy("com.discord.theme.DiscordThemeObject")
    private const val LAZY = "kotlin.Lazy"
    private const val SENTINEL_BASE = 0x5A000000
    private val THEME_SUFFIXES = listOf("dark", "light", "ash", "onyx", "darker", "midnight")

    private data class Palette(
        val semantic: Map<String, Int> = emptyMap(),
        val raw: Map<String, Int> = emptyMap(),
        val rawFallbacks: Map<String, String> = emptyMap(),
    )

    @Volatile private var palette = Palette()

    @Volatile private var rawById: Map<Int, Int> = emptyMap()

    @Volatile private var currentThemeId: String? = null

    @Volatile private var context: Context? = null

    @Volatile private var resources: Resources? = null

    @Volatile private var semanticResources = false
    private var patcher: Patcher? = null

    fun install(xposed: XposedInterface, classLoader: ClassLoader) {
        hookRawColors(xposed)
        if (THEME_MANAGER.find(classLoader) == null) {
            semanticResources = true
            apply()
            SettingsWatcher.onChange(::apply)
            Logger.info(LogCategory.THEMES, "Discord's theme classes are obfuscated, so themes recolour Discord's colour resources.")
            return
        }
        val patcher = Patcher(THEME_OBJECT.load(classLoader), classLoader.loadClass(LAZY), classLoader)
        this.patcher = patcher
        val manager = THEME_MANAGER.load(classLoader)
        val themeType = THEME_TYPE.load(classLoader)
        val instance = manager.getDeclaredField("INSTANCE").get(null)
        val getTheme = manager.getDeclaredMethod("getTheme", themeType)

        xposed.hook(getTheme)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain -> chain.proceed().also { patcher.patch(it) } }

        xposed.hook(manager.getDeclaredMethod("init", Context::class.java))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                chain.proceed().also {
                    context = (chain.getArg(0) as? Context)?.applicationContext
                    rawById = resolveIds()
                    themeType.enumConstants?.forEach { type -> patcher.patch(getTheme.invoke(instance, type)) }
                }
            }

        apply()
        SettingsWatcher.onChange(::apply)
    }

    fun apply() {
        val themeId = NativeBridge.nativePreference("active-theme", null)?.takeIf { it.isNotEmpty() }
        if (themeId == currentThemeId) return
        currentThemeId = themeId

        palette = themeId?.let(::readPalette) ?: Palette()
        rawById = resolveIds()
        patcher?.refreshAll()
        Logger.info(LogCategory.THEMES, "Theme updated. (${themeId ?: "default"})")
    }

    private fun readPalette(themeId: String): Palette {
        NativeBridge.nativePrepareAddons()
        val colors = JSONObject(NativeBridge.nativeThemeColorsJSON(themeId))
        if (colors.length() == 0) {
            Logger.error(LogCategory.THEMES, "Selected theme $themeId is not installed.")
            return Palette()
        }

        return Palette(
            semantic = colors.optJSONObject("semantic").toIntMap().mapKeys { getterName(it.key) },
            raw = colors.optJSONObject("raw").toIntMap(),
            rawFallbacks = colors.optJSONObject("rawFallbacks").toStringMap().mapKeys { getterName(it.key) },
        )
    }

    private fun JSONObject?.toIntMap(): Map<String, Int> =
        this?.keys()?.asSequence()?.associateWith { getLong(it).toInt() } ?: emptyMap()

    private fun JSONObject?.toStringMap(): Map<String, String> =
        this?.keys()?.asSequence()?.associateWith { getString(it) } ?: emptyMap()

    private fun getterName(accessor: String): String = "get" + accessor.replaceFirstChar { it.uppercase() }

    private fun resourceId(name: String): Int {
        val current = context?.resources ?: resources ?: return 0
        return current.getIdentifier(name, "color", context?.packageName ?: Unbound.DISCORD_PACKAGE)
    }

    private fun resolveIds(): Map<Int, Int> = resolveRawIds(palette.raw) + if (semanticResources) semanticIds() else emptyMap()

    private fun semanticIds(): Map<Int, Int> =
        (palette.semantic.keys + palette.rawFallbacks.keys).flatMap { getter ->
            val color = semanticColor(getter) ?: return@flatMap emptyList()
            val base = resourceBase(getter)
            THEME_SUFFIXES.mapNotNull { suffix -> resourceId("${base}_$suffix").takeIf { it != 0 }?.let { it to color } }
        }.toMap()

    private fun resourceBase(getter: String): String =
        getter.removePrefix("get").replace(Regex("([a-z0-9])([A-Z])"), "$1_$2").lowercase()

    private fun useResources(current: Resources) {
        if (resources != null || context != null) return
        resources = current
        rawById = resolveIds()
    }

    private fun resolveRawIds(raw: Map<String, Int>): Map<Int, Int> =
        raw.mapNotNull { (name, color) -> resourceId(name).takeIf { it != 0 }?.let { it to color } }.toMap()

    private fun isThemed(getter: String): Boolean = palette.let { getter in it.semantic || getter in it.rawFallbacks }

    private fun semanticColor(getter: String): Int? {
        val current = palette
        current.semantic[getter]?.let { return it }
        val fallback = current.rawFallbacks[getter] ?: return null
        val id = resourceId(fallback).takeIf { it != 0 } ?: return null
        return rawById[id] ?: context?.getColor(id) ?: resources?.getColor(id, null)
    }

    private fun hookRawColors(xposed: XposedInterface) {
        fun overrideColor(id: Int): Int? = rawById.takeIf { it.isNotEmpty() }?.get(id)

        xposed.hook(Resources::class.java.getDeclaredMethod("getColor", Integer.TYPE, Resources.Theme::class.java))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                if (semanticResources) useResources(chain.thisObject as Resources)
                overrideColor(chain.getArg(0) as Int) ?: chain.proceed()
            }

        xposed.hook(Resources::class.java.getDeclaredMethod("getColorStateList", Integer.TYPE, Resources.Theme::class.java))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                if (semanticResources) useResources(chain.thisObject as Resources)
                overrideColor(chain.getArg(0) as Int)?.let(ColorStateList::valueOf) ?: chain.proceed()
            }

        fun typedArrayOverride(array: TypedArray, index: Int): Int? {
            if (rawById.isEmpty()) return null
            return overrideColor(array.getResourceId(index, 0))
        }

        xposed.hook(TypedArray::class.java.getDeclaredMethod("getColor", Integer.TYPE, Integer.TYPE))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain -> typedArrayOverride(chain.thisObject as TypedArray, chain.getArg(0) as Int) ?: chain.proceed() }

        xposed.hook(TypedArray::class.java.getDeclaredMethod("getColorStateList", Integer.TYPE))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                typedArrayOverride(chain.thisObject as TypedArray, chain.getArg(0) as Int)?.let(ColorStateList::valueOf)
                    ?: chain.proceed()
            }
    }

    private class ThemedField(val field: Field, val original: Any?, val themed: Any)

    private class Patcher(private val themeObject: Class<*>, private val lazyType: Class<*>, private val classLoader: ClassLoader) {
        private val lazyValue: Method = lazyType.getMethod("getValue")
        private val themes = Collections.synchronizedMap(WeakHashMap<Any, Map<String, ThemedField>>())

        fun patch(theme: Any?) {
            if (theme == null || !themeObject.isInstance(theme) || themes.containsKey(theme)) return

            val fields = lazyFields(theme.javaClass)
            val mapping = mapGettersToFields(theme, fields, colorGetters(theme.javaClass)).mapValues { (getter, field) ->
                val original = field.get(theme)
                ThemedField(field, original, lazyProxy { semanticColor(getter) ?: original?.let { lazyValue.invoke(it) } })
            }
            themes[theme] = mapping
            refresh(theme, mapping)
        }

        fun refreshAll() {
            synchronized(themes) { themes.entries.toList() }.forEach { (theme, mapping) -> refresh(theme, mapping) }
        }

        private fun refresh(theme: Any, mapping: Map<String, ThemedField>) {
            for ((getter, entry) in mapping) {
                entry.field.set(theme, if (isThemed(getter)) entry.themed else entry.original)
            }
        }

        private fun mapGettersToFields(theme: Any, fields: List<Field>, getters: List<Method>): Map<String, Field> {
            val originals = fields.map { it.get(theme) }
            try {
                fields.forEachIndexed { index, field -> field.set(theme, lazyProxy { SENTINEL_BASE + index }) }
                return getters.mapNotNull { getter ->
                    val index = (runCatching { getter.invoke(theme) as Int }.getOrNull() ?: return@mapNotNull null) - SENTINEL_BASE
                    fields.getOrNull(index)?.let { getter.name to it }
                }.toMap()
            } finally {
                fields.forEachIndexed { index, field -> field.set(theme, originals[index]) }
            }
        }

        private fun lazyFields(type: Class<*>): List<Field> =
            generateSequence(type) { it.superclass }
                .takeWhile { it != Any::class.java }
                .flatMap { it.declaredFields.asSequence() }
                .filter { it.type == lazyType && !Modifier.isStatic(it.modifiers) }
                .onEach { it.isAccessible = true }
                .toList()

        private fun colorGetters(type: Class<*>): List<Method> =
            type.methods.filter {
                it.name.startsWith("get") &&
                    it.parameterCount == 0 &&
                    it.returnType == Integer.TYPE &&
                    !Modifier.isStatic(it.modifiers)
            }

        private fun lazyProxy(value: () -> Any?): Any =
            Proxy.newProxyInstance(classLoader, arrayOf(lazyType)) { proxy, method, args ->
                when {
                    method.name == "equals" -> proxy === args?.firstOrNull()
                    method.name == "hashCode" -> System.identityHashCode(proxy)
                    method.name == "toString" -> value().toString()
                    method.returnType == java.lang.Boolean.TYPE -> true
                    else -> value()
                }
            }
    }
}
