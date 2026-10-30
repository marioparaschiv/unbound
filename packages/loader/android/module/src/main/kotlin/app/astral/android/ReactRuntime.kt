package app.astral.android

import java.lang.ref.WeakReference
import java.lang.reflect.Method
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

object ReactRuntime {
    private const val BEFORE_BUNDLE_TIMEOUT_SECONDS = 5L
    private const val QUEUE_CONFIGURATION = "com.facebook.react.bridge.queue.ReactQueueConfiguration"

    private val lock = Any()
    private var instance: WeakReference<Any>? = null
    private val pending = ArrayList<(Long) -> Unit>()

    private var javaScriptContextMethod: Method? = null
    private var queueConfiguration: ((Any) -> Any?)? = null

    fun attach(reactInstance: Any) {
        ActivityTracker.install(Platform.application())
        val queued: List<(Long) -> Unit>
        synchronized(lock) {
            instance = WeakReference(reactInstance)
            javaScriptContextMethod = reactInstance.javaClass.findMethod("getJavaScriptContext")
            queueConfiguration = queueConfigurationReader(reactInstance.javaClass)
            queued = ArrayList(pending)
            pending.clear()
        }
        queued.forEach { post(it) }
    }

    fun currentInstance(): Any? = synchronized(lock) { instance?.get() }

    fun post(work: (Long) -> Unit) {
        val target = synchronized(lock) {
            val current = instance?.get()
            if (current == null) {
                pending.add(work)
                return
            }
            current
        }

        val queueThread = runCatching {
            val configuration = queueConfiguration!!.invoke(target)!!
            configuration.javaClass.findMethod("getJSQueueThread")!!.invoke(configuration)!!
        }.onFailure { Logger.error(LogCategory.RUNTIME, "JS queue thread is unavailable", it) }.getOrNull() ?: return

        val runnable = Runnable {
            val pointer = runCatching { javaScriptContextMethod!!.invoke(target) as Long }
                .onFailure { Logger.error(LogCategory.RUNTIME, "JS runtime pointer is unavailable", it) }
                .getOrNull() ?: return@Runnable
            work(pointer)
        }

        runCatching {
            queueThread.javaClass.findMethod("runOnQueue", Runnable::class.java)!!.invoke(queueThread, runnable)
        }.onFailure { Logger.error(LogCategory.RUNTIME, "Failed to schedule work on the JS thread", it) }
    }

    fun runBeforeBundle(work: (Long) -> Unit) {
        val target = synchronized(lock) { instance?.get() } ?: return
        val queueThread = runCatching {
            val configuration = queueConfiguration!!.invoke(target)!!
            configuration.javaClass.findMethod("getJSQueueThread")!!.invoke(configuration)!!
        }.onFailure { Logger.error(LogCategory.RUNTIME, "JS queue thread is unavailable", it) }.getOrNull()
            ?: return

        val runnable = Runnable {
            val pointer = runCatching { javaScriptContextMethod!!.invoke(target) as Long }
                .onFailure { Logger.error(LogCategory.RUNTIME, "JS runtime pointer is unavailable", it) }
                .getOrNull() ?: return@Runnable
            work(pointer)
        }
        val isOnQueue = runCatching {
            queueThread.javaClass.findMethod("isOnThread")?.invoke(queueThread) as? Boolean
        }.getOrNull() == true

        if (isOnQueue) {
            runnable.run()
            return
        }

        val finished = CountDownLatch(1)
        val scheduled = runCatching {
            queueThread.javaClass.findMethod("runOnQueue", Runnable::class.java)!!.invoke(
                queueThread,
                Runnable {
                    try {
                        runnable.run()
                    } finally {
                        finished.countDown()
                    }
                },
            )
        }.onFailure { Logger.error(LogCategory.RUNTIME, "Failed to schedule module capture", it) }.isSuccess

        if (scheduled && !finished.await(BEFORE_BUNDLE_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            Logger.error(LogCategory.RUNTIME, "Module capture did not run before the bundle within ${BEFORE_BUNDLE_TIMEOUT_SECONDS}s")
        }
    }

    private fun queueConfigurationReader(instanceClass: Class<*>): ((Any) -> Any?)? {
        instanceClass.findMethod("getReactQueueConfiguration")?.let { getter -> return { instance -> getter.invoke(instance) } }
        val configurationType = runCatching { instanceClass.classLoader?.loadClass(QUEUE_CONFIGURATION) }.getOrNull() ?: return null
        val field = generateSequence(instanceClass) { it.superclass }
            .flatMap { it.declaredFields.asSequence() }
            .firstOrNull { configurationType.isAssignableFrom(it.type) }
            ?.apply { isAccessible = true }
            ?: return null
        return { instance -> field.get(instance) }
    }

    private fun Class<*>.findMethod(name: String, vararg parameters: Class<*>): Method? {
        var current: Class<*>? = this
        while (current != null) {
            runCatching { current.getDeclaredMethod(name, *parameters) }.getOrNull()?.let {
                it.isAccessible = true
                return it
            }
            current = current.superclass
        }
        return interfaces.firstNotNullOfOrNull { candidate ->
            runCatching { candidate.getMethod(name, *parameters) }.getOrNull()
        }
    }
}
