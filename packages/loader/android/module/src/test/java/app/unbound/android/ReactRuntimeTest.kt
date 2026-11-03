package app.unbound.android

import com.facebook.react.bridge.NativeArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ReactRuntimeTest {
    class SlowQueueThread(private val delayMillis: Long) {
        private val executor = Executors.newSingleThreadExecutor()

        fun isOnThread(): Boolean = false

        fun runOnQueue(runnable: Runnable) {
            executor.execute {
                Thread.sleep(delayMillis)
                runnable.run()
            }
        }

        fun shutdown() {
            executor.shutdown()
            executor.awaitTermination(5, TimeUnit.SECONDS)
        }
    }

    class QueueConfiguration(private val queue: SlowQueueThread) {
        fun getJSQueueThread(): SlowQueueThread = queue
    }

    class FakeReactInstance(private val configuration: QueueConfiguration) {
        fun getJavaScriptContext(): Long = 42L

        fun getReactQueueConfiguration(): QueueConfiguration = configuration
    }

    class SchedulingReactInstance(private val configuration: QueueConfiguration, private val failing: Boolean = false) {
        val calls = ArrayList<Triple<String, String, NativeArray>>()

        fun getJavaScriptContext(): Long = 7L

        fun getReactQueueConfiguration(): QueueConfiguration = configuration

        fun callFunctionOnModule(moduleName: String, methodName: String, args: NativeArray) {
            check(!failing) { "the instance was destroyed" }
            calls.add(Triple(moduleName, methodName, args))
        }
    }

    @Test
    fun drainsUseTheRuntimeSchedulerOnlyAfterTheRouteIsEnabledForThatRuntime() {
        val queue = SlowQueueThread(delayMillis = 0)
        val instance = SchedulingReactInstance(QueueConfiguration(queue))
        ReactRuntime.attach(instance)

        assertFalse(ReactRuntime.postThroughScheduler())
        assertFalse(ReactRuntime.enableSchedulerRoute(8L))
        assertTrue(instance.calls.isEmpty())

        assertTrue(ReactRuntime.enableSchedulerRoute(7L))
        assertTrue(ReactRuntime.postThroughScheduler())

        assertEquals(2, instance.calls.size)
        instance.calls.forEach {
            assertEquals(ReactRuntime.NATIVE_WORK_MODULE, it.first)
            assertEquals(ReactRuntime.NATIVE_WORK_METHOD, it.second)
        }
        assertNotSame("each call needs its own arguments array", instance.calls[0].third, instance.calls[1].third)
        queue.shutdown()
    }

    @Test
    fun attachingANewInstanceFallsBackToTheJsQueueUntilItsRouteIsEnabled() {
        val queue = SlowQueueThread(delayMillis = 0)
        val first = SchedulingReactInstance(QueueConfiguration(queue))
        ReactRuntime.attach(first)
        assertTrue(ReactRuntime.enableSchedulerRoute(7L))

        val second = SchedulingReactInstance(QueueConfiguration(queue))
        ReactRuntime.attach(second)

        assertFalse(ReactRuntime.postThroughScheduler())
        assertTrue(second.calls.isEmpty())
        queue.shutdown()
    }

    @Test
    fun anInstanceWithoutCallFunctionOnModuleKeepsTheJsQueue() {
        val queue = SlowQueueThread(delayMillis = 0)
        ReactRuntime.attach(FakeReactInstance(QueueConfiguration(queue)))

        assertFalse(ReactRuntime.enableSchedulerRoute(42L))
        assertFalse(ReactRuntime.postThroughScheduler())
        queue.shutdown()
    }

    @Test
    fun aFailedSchedulerCallDisablesTheRoute() {
        val queue = SlowQueueThread(delayMillis = 0)
        ReactRuntime.attach(SchedulingReactInstance(QueueConfiguration(queue), failing = true))

        assertFalse(ReactRuntime.enableSchedulerRoute(7L))
        assertFalse(ReactRuntime.postThroughScheduler())
        queue.shutdown()
    }

    @Test
    fun runBeforeBundleReturnsOnlyAfterTheWorkRanOnTheJsQueue() {
        val queue = SlowQueueThread(delayMillis = 300)
        ReactRuntime.attach(FakeReactInstance(QueueConfiguration(queue)))
        val ran = AtomicBoolean(false)
        var pointer = 0L

        ReactRuntime.runBeforeBundle {
            pointer = it
            ran.set(true)
        }

        assertTrue("the work must finish before runBeforeBundle returns", ran.get())
        assertEquals(42L, pointer)
        queue.shutdown()
    }
}
