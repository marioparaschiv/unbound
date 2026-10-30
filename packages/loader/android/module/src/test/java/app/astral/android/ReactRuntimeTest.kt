package app.astral.android

import org.junit.Assert.assertEquals
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

        assertTrue("the capture must finish before runBeforeBundle returns", ran.get())
        assertEquals(42L, pointer)
        queue.shutdown()
    }
}
