package app.unbound.android

object UncaughtExceptions {
    private const val MAX_FRAMES_EACH = 16
    private const val MAX_CAUSES = 4

    fun install() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            runCatching { NativeBridge.nativeRecordUncaughtException(describe(throwable), frames(throwable)) }
            if (previous != null) {
                previous.uncaughtException(thread, throwable)
            } else {
                android.os.Process.killProcess(android.os.Process.myPid())
            }
        }
    }

    fun describe(throwable: Throwable): String {
        val message = throwable.message?.takeIf(String::isNotBlank)
        return if (message == null) throwable.javaClass.name else "${throwable.javaClass.name}: $message"
    }

    fun frames(throwable: Throwable): String {
        val lines = StringBuilder()
        var index = 0
        var current: Throwable? = throwable
        var causes = 0
        while (current != null && causes <= MAX_CAUSES) {
            if (current !== throwable) {
                lines.append("Caused by ").append(describe(current)).append('\n')
            }

            for (frame in current.stackTrace.take(MAX_FRAMES_EACH)) {
                lines.append('#').append(index++).append(" at ").append(frame).append('\n')
            }

            current = current.cause?.takeIf { it !== current }
            causes++
        }

        return lines.toString()
    }
}
