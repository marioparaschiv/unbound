package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

open class MentionSpanStub

class RoleMentionSpanStub : MentionSpanStub()

class TextEditsTest {
    private fun edit(
        start: Int = 4,
        end: Int = 8,
        text: String = "@someone",
        stretchFrom: Int = 4,
        stretchTo: Int = 8,
        stretchClasses: Set<String> = setOf("x"),
    ) =
        TextEdits.Edit(
            start = start,
            end = end,
            text = text,
            spacerOffset = -1,
            width = 0,
            height = 0,
            clearFrom = -1,
            clearTo = -1,
            collapseNext = false,
            imageKey = null,
            imageOffset = 0,
            imageSize = 0,
            stretchFrom = stretchFrom,
            stretchTo = stretchTo,
            stretchClasses = stretchClasses,
        )

    @Test
    fun mapThroughShiftsPositionsAfterALaterRuleEdits() {
        val insertion = edit(start = 10, end = 10, text = "+embed+")
        val replacement = edit(start = 2, end = 6, text = "X")

        assertEquals(1, TextEdits.mapThrough(1, listOf(insertion, replacement)))
        assertEquals(17, TextEdits.mapThrough(10, listOf(insertion)))
        assertEquals(20, TextEdits.mapThrough(16, listOf(insertion, replacement)))
        assertEquals(2, TextEdits.mapThrough(4, listOf(replacement)))
    }

    @Test
    fun appliesEditsOnlyInsideTheText() {
        assertTrue(TextEdits.fits(edit(), 8))
        assertFalse(TextEdits.fits(edit(), 7))
        assertFalse(TextEdits.fits(edit(start = 9, end = 8), 20))
    }

    @Test
    fun stretchesOnlyAWindowWithSpanClasses() {
        assertTrue(TextEdits.stretches(edit()))
        assertFalse(TextEdits.stretches(edit(stretchClasses = emptySet())))
        assertFalse(TextEdits.stretches(edit(stretchFrom = 8, stretchTo = 8)))
    }

    @Test
    fun findsSpansThatOverlapOrCoverTheWindow() {
        val window = edit()

        assertTrue(TextEdits.overlapsStretch(0, 5, window))
        assertTrue(TextEdits.overlapsStretch(7, 12, window))
        assertFalse(TextEdits.overlapsStretch(0, 4, window))
        assertFalse(TextEdits.overlapsStretch(8, 12, window))
        assertTrue(TextEdits.covers(4, 8, window))
        assertFalse(TextEdits.covers(4, 7, window))
    }

    @Test
    fun matchesSpanClassesThroughTheirSuperclasses() {
        val names = setOf(MentionSpanStub::class.java.name)

        assertTrue(TextEdits.isA(RoleMentionSpanStub::class.java, names))
        assertFalse(TextEdits.isA(String::class.java, names))
    }

    @Test
    fun growsStretchedSpansWithTheReplacement() {
        val window = edit(text = "@someone")

        assertEquals(4 until 12, TextEdits.restretchedRange(true, 4, 8, window))
        assertEquals(2 until 6, TextEdits.restretchedRange(false, 2, 6, window))
        assertNull(TextEdits.restretchedRange(false, -1, 6, window))
        assertNull(TextEdits.restretchedRange(true, 0, 0, edit(text = "", stretchFrom = 4, stretchTo = 8)))
    }

    @Test
    fun placesHostsOnTheirPlaceholderLine() {
        val origin = TextEdits.Placement(10f, 20f)
        val padding = TextEdits.Placement(2f, 3f)
        val bottom = TextEdits.Anchor(placeholder = 5, width = 40, height = 16, pinTop = false, offsetY = 1)
        val top = bottom.copy(pinTop = true, offsetY = -2)

        assertEquals(TextEdits.Placement(42f, 92f), TextEdits.placement(bottom, origin, 30f, 50, 84, padding))
        assertEquals(TextEdits.Placement(42f, 71f), TextEdits.placement(top, origin, 30f, 50, 84, padding))
    }
}
