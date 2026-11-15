package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Test

class MainThreadWatchdogTest {
    @Test
    fun namesTheBlockingPluginAndTheStack() {
        val message = MainThreadWatchdog.stallMessage(5120, "Chat Bubbles", listOf("a.B.c(B.java:1)"))

        assertEquals(
            "Discord's main thread has been blocked for 5120 ms while Chat Bubbles ran on it.\n    at a.B.c(B.java:1)",
            message,
        )
    }

    @Test
    fun leavesTheBlameOutWithoutAPlugin() {
        assertEquals(
            "Discord's main thread has been blocked for 4000 ms.\n",
            MainThreadWatchdog.stallMessage(4000, null, emptyList()),
        )
    }
}
