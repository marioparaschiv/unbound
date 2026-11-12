package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FontOverflowTest {
    @Test
    fun leavesInkThatFitsItsBox() {
        assertNull(FontOverflow.centredBaseline(box = 20, baseline = 15, top = 12, bottom = 4))
        assertNull(FontOverflow.centredBaseline(box = 20, baseline = 15, top = 15, bottom = 5))
    }

    @Test
    fun centresInkThatReachesAboveItsBox() {
        // "Add Friends" in Pacifico: letters 13 px tall, no descenders, in an 18 px box seated at 12.
        assertEquals(15, FontOverflow.centredBaseline(box = 18, baseline = 12, top = 13, bottom = 0))
    }

    @Test
    fun centresInkTallerThanItsBox() {
        // "Messages" in Pacifico: its g makes the ink 27 px in a 24 px box, so each side reaches 1 to 2 px out.
        val baseline = FontOverflow.centredBaseline(box = 24, baseline = 15, top = 18, bottom = 9)
        assertEquals(16, baseline)
        assertEquals(2, FontOverflow.overhang(box = 24, baseline = 15, ink = FontOverflow.Ink(top = 18, bottom = 9, side = 0)))
    }

    @Test
    fun countsInkPastALettersAdvance() {
        assertEquals(4, FontOverflow.overhang(box = 20, baseline = 15, ink = FontOverflow.Ink(top = 12, bottom = 4, side = 4)))
        assertEquals(0, FontOverflow.overhang(box = 20, baseline = 15, ink = FontOverflow.Ink(top = 12, bottom = 4, side = -2)))
    }
}
