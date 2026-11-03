package app.unbound.android

import java.lang.ref.WeakReference
import java.lang.reflect.Constructor
import java.lang.reflect.Method
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

object ReactRuntime {
    private const val BEFORE_BUNDLE_TIMEOUT_SECONDS = 5L
    private const val QUEUE_CONFIGURATION = "com.facebook.react.bridge.queue.ReactQueueConfiguration"
    private const val WRITABLE_NATIVE_ARRAY = "com.facebook.react.bridge.WritableNativeArray"
    private const val CALL_FUNCTION_ON_MODULE = "callFunctionOnModule"
    const val NATIVE_WORK_MODULE = "UnboundNativeWork"
    const val NATIVE_WORK_METHOD = "drain"

    private val lock = Any()
    private var instance: WeakReference<Any>? = null
    private val pending = ArrayList<(Long) -> Unit>()

    private var javaScriptContextMethod: Method? = null
    private var queueConfiguration: ((Any) -> Any?)? = null

    private class JsQueue(val owner: WeakReference<Any>, val thread: Any, val runOnQueue: Method)

    @Volatile
    private var jsQueue: JsQueue? = null

    private class SchedulerRoute(val owner: WeakReference<Any>, val callFunctionOnModule: Method, val arguments: Constructor<*>)

    @Volatile
    private var schedulerRoute: SchedulerRoute? = null

    private fun jsQueueFor(target: Any): JsQueue? {
        jsQueue?.takeIf { it.owner.get() === target }?.let { return it }

        return runCatching {
            val configuration = queueConfiguration!!.invoke(target)!!
            val thread = configuration.javaClass.findMethod("getJSQueueThread")!!.invoke(configuration)!!
            val runOnQueue = thread.javaClass.findMethod("runOnQueue", Runnable::class.java)!!
            JsQueue(WeakReference(target), thread, runOnQueue)
        }.onFailure { Logger.error(LogCategory.RUNTIME, "JS queue thread is unavailable", it) }
            .getOrNull()
            ?.also { jsQueue = it }
    }

    fun attach(reactInstance: Any) {
        ActivityTracker.install(Platform.application())
        val queued: List<(Long) -> Unit>
        synchronized(lock) {
            schedulerRoute = null
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

        val queue = jsQueueFor(target) ?: return

        val runnable = Runnable {
            val pointer = runCatching { javaScriptContextMethod!!.invoke(target) as Long }
                .onFailure { Logger.error(LogCategory.RUNTIME, "JS runtime pointer is unavailable", it) }
                .getOrNull() ?: return@Runnable
            work(pointer)
        }

        runCatching {
            queue.runOnQueue.invoke(queue.thread, runnable)
        }.onFailure { Logger.error(LogCategory.RUNTIME, "Failed to schedule work on the JS thread", it) }
    }

    fun enableSchedulerRoute(runtimePointer: Long): Boolean {
        val target = currentInstance() ?: return false
        val pointer = runCatching { javaScriptContextMethod?.invoke(target) as? Long }.getOrNull()
        if (pointer != runtimePointer) return false

        val route = schedulerRouteFor(target)
        if (route == null) {
            Logger.info(
                LogCategory.RUNTIME,
                "RuntimeScheduler is unreachable, loader work drains on the JS queue with explicit microtask checkpoints",
            )
            return false
        }
        schedulerRoute = route
        return postThroughScheduler()
    }

    fun postThroughScheduler(): Boolean {
        val target = currentInstance() ?: return false
        val route = schedulerRoute?.takeIf { it.owner.get() === target } ?: return false

        return runCatching {
            route.callFunctionOnModule.invoke(target, NATIVE_WORK_MODULE, NATIVE_WORK_METHOD, route.arguments.newInstance())
        }.onFailure {
            schedulerRoute = null
            Logger.error(LogCategory.RUNTIME, "Failed to schedule loader work through the RuntimeScheduler, using the JS queue", it)
        }.isSuccess
    }

    private fun schedulerRouteFor(target: Any): SchedulerRoute? = runCatching {
        val argumentsType = Class.forName(WRITABLE_NATIVE_ARRAY, true, target.javaClass.classLoader)
        val method = generateSequence(target.javaClass as Class<*>) { it.superclass }
            .flatMap { it.declaredMethods.asSequence() }
            .firstOrNull { it.acceptsModuleCall(argumentsType) }
            ?.apply { isAccessible = true }
            ?: return@runCatching null
        val constructor = argumentsType.getDeclaredConstructor().apply { isAccessible = true }
        SchedulerRoute(WeakReference(target), method, constructor)
    }.onFailure { Logger.error(LogCategory.RUNTIME, "RuntimeScheduler route is unavailable", it) }.getOrNull()

    private fun Method.acceptsModuleCall(argumentsType: Class<*>): Boolean =
        name == CALL_FUNCTION_ON_MODULE &&
            parameterTypes.size == 3 &&
            parameterTypes[0] == String::class.java &&
            parameterTypes[1] == String::class.java &&
            parameterTypes[2].isAssignableFrom(argumentsType)

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
        }.onFailure { Logger.error(LogCategory.RUNTIME, "Failed to schedule Unbound before Discord's bundle", it) }.isSuccess

        if (scheduled && !finished.await(BEFORE_BUNDLE_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            Logger.error(LogCategory.RUNTIME, "Unbound did not run before Discord's bundle within ${BEFORE_BUNDLE_TIMEOUT_SECONDS}s")
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
