package app.astral.android

import android.util.Log

enum class LogCategory(val id: String) {
    DEFAULT("default"),
    RUNTIME("runtime"),
    UPDATER("updater"),
    THEMES("themes"),
    FONTS("fonts"),
    PLUGINS("plugins"),
    SETTINGS("settings"),
    TOOLBOX("toolbox"),
    HOOKS("hooks"),
}

object Logger {
    private const val TAG = "astral"

    private enum class Level(val priority: Int) {
        DEBUG(Log.DEBUG),
        INFO(Log.INFO),
        WARNING(Log.WARN),
        ERROR(Log.ERROR),
    }

    private const val EARLY_LINES_KEPT = 256

    private val earlyLines = EarlyLogBuffer(EARLY_LINES_KEPT)

    @Volatile var nativeReady = false
        set(ready) {
            field = ready
            if (ready) {
                earlyLines.drain { line ->
                    runCatching { NativeBridge.nativeAppendLogFile(line.level, line.category, line.message) }
                }
            }
        }

    fun debug(category: LogCategory, message: String) = write(Level.DEBUG, category, message)

    fun info(category: LogCategory, message: String) = write(Level.INFO, category, message)

    fun warning(category: LogCategory, message: String) = write(Level.WARNING, category, message)

    fun error(category: LogCategory, message: String, error: Throwable? = null) =
        write(Level.ERROR, category, error?.let { "$message\n${Log.getStackTraceString(it)}" } ?: message)

    private fun write(level: Level, category: LogCategory, message: String) {
        if (nativeReady && runCatching { NativeBridge.nativeLog(level.ordinal, category.id, message) }.isSuccess) return
        if (!nativeReady) earlyLines.add(EarlyLogLine(level.ordinal, category.id, message))
        Log.println(level.priority, TAG, "[${category.id}] $message")
    }
}

data class EarlyLogLine(val level: Int, val category: String, val message: String)

class EarlyLogBuffer(private val capacity: Int) {
    private val lines = ArrayDeque<EarlyLogLine>()

    @Synchronized
    fun add(line: EarlyLogLine) {
        lines.addLast(line)
        while (lines.size > capacity) lines.removeFirst()
    }

    @Synchronized
    fun drain(write: (EarlyLogLine) -> Unit) {
        while (lines.isNotEmpty()) write(lines.removeFirst())
    }
}
