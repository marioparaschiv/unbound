package app.unbound.android

import java.lang.reflect.Modifier

/**
 * React Native's font manager caches each family's typefaces, so a font change would not reach the
 * families it already loaded. Discord obfuscates the class, so it is found by its shape on the stack
 * of the first asset font it loads: a singleton held in a static field of its own type, whose
 * instance maps are the caches.
 */
internal object ReactFontCache {
    private val PLATFORM = listOf("android.", "java.", "kotlin.", "dalvik.", "app.unbound.")

    @Volatile private var caches: List<MutableMap<*, *>>? = null

    /** Finds the caches from the calling stack, once. Called from inside React Native's font loading. */
    fun discover() {
        if (caches != null) return
        caches = runCatching { find(Throwable().stackTrace) }
            .onFailure { Logger.error(LogCategory.FONTS, "Failed to find React Native's font cache", it) }
            .getOrNull()
            .orEmpty()
        if (caches.isNullOrEmpty()) {
            Logger.warning(LogCategory.FONTS, "React Native's font cache was not found; font changes apply after a reload.")
        }
    }

    /** Empties the caches, so React Native loads each family again through the typeface hooks. */
    fun clear() {
        for (cache in caches.orEmpty()) cache.clear()
    }

    internal fun find(stack: Array<StackTraceElement>): List<MutableMap<*, *>> {
        val loader = Platform.application()?.classLoader ?: return emptyList()
        for (frame in stack) {
            // Typeface itself has a static field of its own type.
            if (PLATFORM.any(frame.className::startsWith)) continue
            val type = runCatching { Class.forName(frame.className, false, loader) }.getOrNull() ?: continue
            val caches = cachesOf(type)
            if (caches.isNotEmpty()) return caches
        }
        return emptyList()
    }

    internal fun cachesOf(type: Class<*>): List<MutableMap<*, *>> {
        val fields = type.declaredFields
        val singleton = fields.firstOrNull { Modifier.isStatic(it.modifiers) && it.type == type } ?: return emptyList()
        val instance = singleton.apply { isAccessible = true }.get(null) ?: return emptyList()
        return fields
            .filter { !Modifier.isStatic(it.modifiers) && MutableMap::class.java.isAssignableFrom(it.type) }
            .mapNotNull { field -> field.apply { isAccessible = true }.get(instance) as? MutableMap<*, *> }
    }
}
