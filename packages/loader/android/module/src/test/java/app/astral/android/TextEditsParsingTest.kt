package app.astral.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class TextEditsParsingTest {
    @Test
    fun parsesAnchorsWithDefaults() {
        assertEquals(
            TextEdits.Anchor(placeholder = 3, width = 40, height = 20, pinTop = false, offsetY = 0),
            TextEdits.parseAnchor("""{"placeholder":3,"width":40,"height":20}"""),
        )
        assertEquals(
            TextEdits.Anchor(placeholder = 3, width = 40, height = 20, pinTop = true, offsetY = -4),
            TextEdits.parseAnchor("""{"placeholder":3,"width":40,"height":20,"pinTop":true,"offsetY":-4}"""),
        )
    }

    @Test
    fun parsesEditsWithOptionalFields() {
        val edits = TextEdits.parseEdits(
            """[{"start":1,"end":2,"text":"x"},{"start":3,"end":5,"text":"yy","imageKey":"emoji","stretchFrom":3,"stretchTo":5,"stretchClasses":["a.B"]}]""",
        )

        assertEquals(-1, edits[0].spacerOffset)
        assertNull(edits[0].imageKey)
        assertEquals(emptySet<String>(), edits[0].stretchClasses)
        assertEquals("emoji", edits[1].imageKey)
        assertEquals(3, edits[1].stretchFrom)
        assertEquals(setOf("a.B"), edits[1].stretchClasses)
    }
}
