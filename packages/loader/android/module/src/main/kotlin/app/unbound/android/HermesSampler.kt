package app.unbound.android

import java.io.File

object HermesSampler {
    private const val PROFILER_CLASS = "com.facebook.hermes.instrumentation.HermesSamplingProfiler"

    private fun profiler(): Class<*>? = runCatching {
        val loader = Platform.application()?.classLoader ?: HermesSampler::class.java.classLoader
        Class.forName(PROFILER_CLASS, true, loader)
    }.getOrNull()

    @JvmStatic
    fun start(): Boolean {
        val profiler = profiler() ?: return false
        return runCatching { profiler.getMethod("enable").invoke(null) }.isSuccess
    }

    @JvmStatic
    fun stop(): String {
        val profiler = profiler() ?: return ""
        val context = Platform.application() ?: return ""
        val trace = File(context.cacheDir, "unbound-sampled-trace.json")

        return runCatching {
            profiler.getMethod("dumpSampledTraceToFile", String::class.java).invoke(null, trace.path)
            trace.readText()
        }.getOrDefault("").also {
            runCatching { profiler.getMethod("disable").invoke(null) }
            trace.delete()
        }
    }
}
