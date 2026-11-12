package app.unbound.android

import android.graphics.Typeface
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FontsTest {
    @Test
    fun parsesAssetFontNamesWithTheirStyle() {
        assertEquals(Fonts.AssetFont("ggsans", Typeface.NORMAL), Fonts.assetFont("fonts/ggsans.ttf"))
        assertEquals(Fonts.AssetFont("ggsans", Typeface.BOLD), Fonts.assetFont("fonts/ggsans_bold.ttf"))
        assertEquals(Fonts.AssetFont("ggsans", Typeface.ITALIC), Fonts.assetFont("fonts/ggsans_italic.otf"))
        assertEquals(Fonts.AssetFont("ggsans", Typeface.BOLD_ITALIC), Fonts.assetFont("fonts/ggsans_bold_italic.ttf"))
        assertEquals(Fonts.AssetFont("gg_sans_medium", Typeface.NORMAL), Fonts.assetFont("fonts/gg_sans_medium.ttf"))
    }

    @Test
    fun ignoresAssetsThatAreNotFonts() {
        assertNull(Fonts.assetFont("fonts/ggsans.woff"))
        assertNull(Fonts.assetFont("images/ggsans.ttf"))
        assertNull(Fonts.assetFont("fonts/.ttf"))
    }

    @Test
    fun choosesTheReplacementSource() {
        assertNull(Fonts.replacement("", "/data/font.ttf", ""))
        assertEquals(Fonts.Source.Failed("broken"), Fonts.replacement("Inter", "/data/font.ttf", "broken"))
        assertEquals(Fonts.Source.System("serif"), Fonts.replacement("serif", "", ""))
        assertEquals(Fonts.Source.Asset("fonts/inter.ttf"), Fonts.replacement("Inter", "asset:fonts/inter.ttf", ""))
        assertEquals(Fonts.Source.File("/data/inter.ttf"), Fonts.replacement("Inter", "/data/inter.ttf", ""))
        assertEquals(
            Fonts.Source.File("/data/inter.ttf", "'wght' 650.0, 'ital' 1.0"),
            Fonts.replacement("Inter-wght650", "/data/inter.ttf", "", linkedMapOf("wght" to 650.0, "ital" to 1.0)),
        )
    }

    @Test
    fun padsShortAxisTagsAndSkipsLongOnes() {
        assertEquals("'MY  ' 2.0", Fonts.variationSettings(linkedMapOf("MY" to 2.0, "TOOLONG" to 1.0)))
        assertEquals("", Fonts.variationSettings(emptyMap()))
    }
}
