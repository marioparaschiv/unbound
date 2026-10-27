package app.unbound.android

import android.view.View
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

object ViewClippingUtils350 {
    @JvmStatic
    @Suppress("UNUSED_PARAMETER")
    fun clipToCircle(view: View) = Unit
}

class ChatAppearanceTest {
    @Test
    fun hooksClipToCircleOnlyWhileDiscordNamesIt() {
        assertEquals("clipToCircle", ChatAppearance.clipToCircle(ViewClippingUtils350::class.java)?.name)
        assertNull(ChatAppearance.clipToCircle(null))
        assertNull(ChatAppearance.clipToCircle(String::class.java))
    }

    @Test
    fun recognisesOnlyFullCircleOutlines() {
        val size = ChatAppearance.PROBE_SIZE

        assertTrue(ChatAppearance.isCircleOutline(true, size, size, size / 2f))
        assertFalse(ChatAppearance.isCircleOutline(false, size, size, size / 2f))
        assertFalse(ChatAppearance.isCircleOutline(true, size, size, 8f))
        assertFalse(ChatAppearance.isCircleOutline(true, size - 2, size, size / 2f))
        assertFalse(ChatAppearance.isCircleOutline(true, size, size, 0f))
    }

    @Test
    fun prefersTheThemeManagerOverTheTextColour() {
        var read = false

        assertFalse(ChatAppearance.isDarkTheme(false) { 0.9f.also { read = true } })
        assertFalse(read)
    }

    @Test
    fun treatsLightTextAsADarkTheme() {
        assertTrue(ChatAppearance.isDarkTheme(null) { 0.9f })
        assertFalse(ChatAppearance.isDarkTheme(null) { 0.1f })
        assertFalse(ChatAppearance.isDarkTheme(null) { 0.5f })
        assertTrue(ChatAppearance.isDarkTheme(null) { null })
    }
}
