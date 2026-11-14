package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AnimatedIconFramesTest {
    @Test
    fun readsDurationsAndRestFrame() {
        val timing = AnimatedIconFrames.parseTiming("""{"rest": 1, "durations": [80, 2520, 4]}""")
        assertEquals(listOf(80L, 2520L, 16L), timing?.durations)
        assertEquals(1, timing?.rest)
    }

    @Test
    fun clampsTheRestFrameAndRejectsEmptyTimings() {
        assertEquals(0, AnimatedIconFrames.parseTiming("""{"rest": 9, "durations": [80]}""")?.rest)
        assertNull(AnimatedIconFrames.parseTiming("""{"durations": []}"""))
        assertNull(AnimatedIconFrames.parseTiming("not json"))
    }

    @Test
    fun namesFramesLikeTheIPAAssets() {
        assertEquals("assets/animated-icon/UnboundAnimated0760x60@3x.png", AnimatedIconFrames.frameEntry(7))
    }
}
