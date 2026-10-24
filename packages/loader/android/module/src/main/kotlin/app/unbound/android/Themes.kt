package app.unbound.android

import android.content.Context
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
    private const val THEME_MANAGER = "com.discord.theme.ThemeManager"
    private const val THEME_TYPE = "com.discord.theme.DiscordTheme"
    private const val THEME_OBJECT = "com.discord.theme.DiscordThemeObject"
    private const val LAZY = "kotlin.Lazy"
    private const val SENTINEL_BASE = 0x5A000000

    private val patched = Collections.synchronizedSet(Collections.newSetFromMap(WeakHashMap<Any, Boolean>()))

    fun install(xposed: XposedInterface, classLoader: ClassLoader) {
        if (Recovery.isEnabled()) return

        val applied = NativeBridge.nativeSettingJSON("themes", "applied")
            ?.let { runCatching { JSONObject("{\"id\":$it}").optString("id") }.getOrNull() }
            ?.takeIf { it.isNotEmpty() } ?: return

        NativeBridge.nativePrepareAddons()
        val colors = JSONObject(NativeBridge.nativeThemeColorsJSON(applied))
        if (colors.length() == 0) {
            Logger.info("themes", "Theme $applied has no native semantic colors.")
            return
        }

        val overrides = colors.keys().asSequence().associate { getterName(it) to colors.getLong(it).toInt() }
        val patcher = Patcher(
            classLoader.loadClass(THEME_OBJECT),
            classLoader.loadClass(LAZY),
            classLoader,
            overrides,
        )

        val manager = classLoader.loadClass(THEME_MANAGER)
        val themeType = classLoader.loadClass(THEME_TYPE)
        val instance = manager.getDeclaredField("INSTANCE").get(null)
        val getTheme = manager.getDeclaredMethod("getTheme", themeType)

        xposed.hook(getTheme)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain -> chain.proceed().also { patcher.patch(it) } }

        xposed.hook(manager.getDeclaredMethod("init", Context::class.java))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                chain.proceed().also {
                    themeType.enumConstants?.forEach { type -> patcher.patch(getTheme.invoke(instance, type)) }
                    Logger.info("themes", "Applied theme $applied to ${overrides.size} native colors.")
                }
            }
    }

    private fun getterName(key: String): String =
        "get" + key.lowercase().split('_', '-', '.')
            .filter { it.isNotEmpty() }
            .joinToString("") { part -> part.replaceFirstChar { it.uppercase() } }

    private class Patcher(
        private val themeObject: Class<*>,
        private val lazyType: Class<*>,
        private val classLoader: ClassLoader,
        private val overrides: Map<String, Int>,
    ) {
        fun patch(theme: Any?) {
            if (theme == null || !themeObject.isInstance(theme) || !patched.add(theme)) return

            val fields = lazyFields(theme.javaClass)
            val getters = overrides.keys.mapNotNull { name -> getter(theme.javaClass, name)?.let { name to it } }
            val mapping = mapGettersToFields(theme, fields, getters)

            for ((name, field) in mapping) {
                field.set(theme, constantLazy(overrides.getValue(name)))
            }
        }

        private fun mapGettersToFields(theme: Any, fields: List<Field>, getters: List<Pair<String, Method>>): Map<String, Field> {
            val originals = fields.map { it.get(theme) }
            try {
                fields.forEachIndexed { index, field -> field.set(theme, constantLazy(SENTINEL_BASE + index)) }
                return getters.mapNotNull { (name, getter) ->
                    val index = (runCatching { getter.invoke(theme) as Int }.getOrNull() ?: return@mapNotNull null) - SENTINEL_BASE
                    fields.getOrNull(index)?.let { name to it }
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

        private fun getter(type: Class<*>, name: String): Method? =
            runCatching { type.getMethod(name) }.getOrNull()?.takeIf { it.returnType == Integer.TYPE }

        private fun constantLazy(value: Int): Any {
            val boxed: Any = value
            return Proxy.newProxyInstance(classLoader, arrayOf(lazyType)) { proxy, method, args ->
                when {
                    method.name == "equals" -> proxy === args?.firstOrNull()
                    method.name == "hashCode" -> System.identityHashCode(proxy)
                    method.name == "toString" -> value.toString()
                    method.returnType == java.lang.Boolean.TYPE -> true
                    else -> boxed
                }
            }
        }
    }
}
