package app.astral.android

import java.io.File

object HermesSampler {
    private const val PROFILER_CLASS = "com.facebook.hermes.instrumentation.HermesSamplingProfiler"

    private fun profiler(): Class<*>? = runCatching {
        val loader = Platform.application()?.classLoader ?: HermesSampler::class.java.classLoader
        Class.forName(PROFILER_CLASS, true, loader)
    }.getOrNull()

    @JvmStatic
    fun sample(durationMs: Long): String {
        val profiler = profiler() ?: return ""
        val context = Platform.application() ?: return ""
        val trace = File(context.cacheDir, "astral-freeze-trace.json")

        return runCatching {
            profiler.getMethod("enable").invoke(null)
            Thread.sleep(durationMs)
            profiler.getMethod("dumpSampledTraceToFile", String::class.java).invoke(null, trace.path)
            profiler.getMethod("disable").invoke(null)
            trace.readText()
        }.getOrDefault("").also { trace.delete() }
    }
}
