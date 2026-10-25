package app.unbound.android

import android.util.Log

enum class LogCategory(val id: String) {
    DEFAULT("default"),
    RUNTIME("runtime"),
    UPDATER("updater"),
    THEMES("themes"),
    FONTS("fonts"),
    CHATUI("chatui"),
    PLUGINS("plugins"),
    SETTINGS("settings"),
    TOOLBOX("toolbox"),
    HOOKS("hooks"),
}

object Logger {
    private const val TAG = "Unbound"

    private enum class Level(val priority: Int) {
        DEBUG(Log.DEBUG),
        INFO(Log.INFO),
        WARNING(Log.WARN),
        ERROR(Log.ERROR),
    }

    @Volatile var nativeReady = false

    fun debug(category: LogCategory, message: String) = write(Level.DEBUG, category, message)

    fun info(category: LogCategory, message: String) = write(Level.INFO, category, message)

    fun warning(category: LogCategory, message: String) = write(Level.WARNING, category, message)

    fun error(category: LogCategory, message: String, error: Throwable? = null) =
        write(Level.ERROR, category, error?.let { "$message\n${Log.getStackTraceString(it)}" } ?: message)

    private fun write(level: Level, category: LogCategory, message: String) {
        if (nativeReady && runCatching { NativeBridge.nativeLog(level.ordinal, category.id, message) }.isSuccess) return
        Log.println(level.priority, TAG, "[${category.id}] $message")
    }
}
