package app.unbound.android

import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.StrictMode
import android.os.strictmode.Violation
import java.util.concurrent.Executors

internal object DiskOnMainDetector {
    private const val STACK_FRAMES = 14
    private const val UNBOUND_FRAMES = "app.unbound."
    private const val MAXIMUM_REPORTS = 50

    private val reported = mutableSetOf<String>()

    fun start() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return
        Handler(Looper.getMainLooper()).post {
            runCatching {
                val policy = StrictMode.ThreadPolicy.Builder(StrictMode.getThreadPolicy())
                    .detectDiskReads()
                    .detectDiskWrites()
                    .penaltyListener(Executors.newSingleThreadExecutor(), ::onViolation)
                    .build()
                StrictMode.setThreadPolicy(policy)
            }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to watch for disk access on the main thread", it) }
        }
    }

    private fun onViolation(violation: Violation) {
        val frames = violation.stackTrace.map { it.toString() }
        val place = unboundFrame(frames) ?: return
        synchronized(reported) {
            if (reported.size >= MAXIMUM_REPORTS || !reported.add(place)) return
        }
        Logger.warning(LogCategory.DEFAULT, violationMessage(violation.javaClass.simpleName, frames))
    }

    internal fun unboundFrame(frames: List<String>): String? = frames.firstOrNull { it.startsWith(UNBOUND_FRAMES) }

    internal fun violationMessage(kind: String, frames: List<String>): String =
        "Plugin code touched the disk on Discord's main thread ($kind), which stalls the UI on slow storage:\n" +
            frames.take(STACK_FRAMES).joinToString("\n") { "    at $it" }
}
