package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Test

class EarlyLogBufferTest {
    @Test
    fun keepsOnlyTheNewestLines() {
        val buffer = EarlyLogBuffer(2)
        buffer.add(EarlyLogLine(1, "default", "first"))
        buffer.add(EarlyLogLine(1, "default", "second"))
        buffer.add(EarlyLogLine(3, "hooks", "third"))
        val drained = mutableListOf<String>()
        buffer.drain { drained.add(it.message) }
        assertEquals(listOf("second", "third"), drained)
    }

    @Test
    fun drainsOnce() {
        val buffer = EarlyLogBuffer(4)
        buffer.add(EarlyLogLine(1, "default", "only"))
        buffer.drain {}
        val drained = mutableListOf<String>()
        buffer.drain { drained.add(it.message) }
        assertEquals(emptyList<String>(), drained)
    }
}
