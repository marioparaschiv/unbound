package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DiskOnMainDetectorTest {
    @Test
    fun blamesTheFirstUnboundFrame() {
        val frames = listOf("java.io.File.exists(File.java:1)", "app.unbound.android.NativeJava.invoke(NativeJava.kt:9)")

        assertEquals("app.unbound.android.NativeJava.invoke(NativeJava.kt:9)", DiskOnMainDetector.unboundFrame(frames))
    }

    @Test
    fun ignoresDiscordsOwnDiskAccess() {
        assertNull(DiskOnMainDetector.unboundFrame(listOf("java.io.File.exists(File.java:1)", "com.discord.Store.load(Store.kt:3)")))
    }

    @Test
    fun namesTheViolationAndTheStack() {
        assertEquals(
            "Plugin code touched the disk on Discord's main thread (DiskReadViolation), which stalls the UI on slow storage:\n    at a.B.c(B.java:1)",
            DiskOnMainDetector.violationMessage("DiskReadViolation", listOf("a.B.c(B.java:1)")),
        )
    }
}
