package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UncaughtExceptionsTest {
    @Test
    fun describesTheExceptionWithItsMessage() {
        assertEquals(
            "java.lang.IllegalStateException: no view",
            UncaughtExceptions.describe(IllegalStateException("no view")),
        )
        assertEquals("java.lang.RuntimeException", UncaughtExceptions.describe(RuntimeException()))
    }

    @Test
    fun listsNumberedFramesAndCauses() {
        val frames = UncaughtExceptions.frames(RuntimeException("outer", IllegalArgumentException("inner")))

        assertTrue(frames.startsWith("#0 at "))
        assertTrue(frames.contains("Caused by java.lang.IllegalArgumentException: inner\n"))
    }
}
