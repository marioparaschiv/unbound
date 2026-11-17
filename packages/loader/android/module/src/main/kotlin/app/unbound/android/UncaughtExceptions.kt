package app.unbound.android

object UncaughtExceptions {
    private const val MAX_FRAMES_EACH = 16
    private const val MAX_CAUSES = 4

    fun install() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            runCatching {
                NativeBridge.nativeRecordUncaughtException(describe(throwable) + hookBlame(throwable), frames(throwable))
            }
            if (previous != null) {
                previous.uncaughtException(thread, throwable)
            } else {
                android.os.Process.killProcess(android.os.Process.myPid())
            }
        }
    }

    private fun allFrames(throwable: Throwable): List<StackTraceElement> =
        generateSequence(throwable) { it.cause?.takeIf { cause -> cause !== it } }
            .take(MAX_CAUSES + 1)
            .flatMap { it.stackTrace.asSequence() }
            .toList()

    private fun hookBlame(throwable: Throwable): String {
        val (token, target) = NativeHooks.hookedFrames(allFrames(throwable)).firstOrNull() ?: return ""
        val owner = runCatching { NativeBridge.nativeHookOwner(token) }.getOrNull() ?: return ""
        return blameText(owner, target)
    }

    internal fun blameText(owner: String, target: String): String = " (through $owner's hook on $target)"

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
