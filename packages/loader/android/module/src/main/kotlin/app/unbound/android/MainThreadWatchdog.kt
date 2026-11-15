package app.unbound.android

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import org.json.JSONObject
import kotlin.concurrent.thread

internal object MainThreadWatchdog {
    private const val CHECK_INTERVAL_MS = 1000L
    private const val STALL_THRESHOLD_MS = 4000L
    private const val STACK_FRAMES = 24

    @Volatile private var lastBeat = 0L
    @Volatile private var started = false

    fun start() {
        if (started) return
        started = true
        lastBeat = SystemClock.uptimeMillis()
        val main = Handler(Looper.getMainLooper())
        main.post { runCatching { NativeBridge.nativeMarkMainThread() } }
        thread(isDaemon = true, name = "UnboundMainWatchdog") { watch(main) }
    }

    private fun watch(main: Handler) {
        var reported = false
        while (true) {
            main.post { lastBeat = SystemClock.uptimeMillis() }
            SystemClock.sleep(CHECK_INTERVAL_MS)
            val stalled = SystemClock.uptimeMillis() - lastBeat
            if (stalled < STALL_THRESHOLD_MS) {
                reported = false
                continue
            }
            if (reported) continue
            reported = true
            runCatching { report(stalled) }
                .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to report the main thread stall", it) }
        }
    }

    private fun report(stalled: Long) {
        val addon = runCatching { NativeBridge.nativeAddonOnMainThread() }.getOrNull()?.let(::addonName)
        Logger.error(LogCategory.DEFAULT, stallMessage(stalled, addon, mainStack()))
    }

    private fun mainStack(): List<String> =
        Looper.getMainLooper().thread.stackTrace.take(STACK_FRAMES).map { it.toString() }

    private fun addonName(record: String): String? =
        runCatching { JSONObject(record).optString("name").ifEmpty { null } }.getOrNull()

    internal fun stallMessage(stalled: Long, addon: String?, stack: List<String>): String {
        val blame = addon?.let { " while $it ran on it" }.orEmpty()
        return "Discord's main thread has been blocked for $stalled ms$blame.\n" +
            stack.joinToString("\n") { "    at $it" }
    }
}
