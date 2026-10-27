package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ThemesTest {
    private val resources = mapOf(
        "background_primary_dark" to 10,
        "background_primary_light" to 11,
        "background_primary_midnight" to 12,
        "text_normal_onyx" to 20,
        "brand_500" to 30,
    )

    private val resourceId: (String) -> Int = { resources[it] ?: 0 }

    @Test
    fun recoloursResourcesOnlyWithoutTheThemeManager() {
        assertEquals(Themes.Source.COLOR_RESOURCES, Themes.source(null))
        assertEquals(Themes.Source.THEME_MANAGER, Themes.source(Any::class.java))
    }

    @Test
    fun turnsThemeGettersIntoResourceNames() {
        assertEquals("getBackgroundPrimary", Themes.getterName("backgroundPrimary"))
        assertEquals("background_primary", Themes.resourceBase("getBackgroundPrimary"))
        assertEquals("bg2_primary", Themes.resourceBase("getBg2Primary"))
        assertEquals("text", Themes.resourceBase("getText"))
    }

    @Test
    fun mapsEverySuffixedSemanticResourceToItsColour() {
        val ids = Themes.semanticResourceIds(mapOf("getBackgroundPrimary" to 1, "getTextNormal" to 2, "getMissing" to 3), resourceId)

        assertEquals(mapOf(10 to 1, 11 to 1, 12 to 1, 20 to 2), ids)
    }

    @Test
    fun mapsRawColoursByResourceName() {
        assertEquals(mapOf(30 to 7), Themes.rawResourceIds(mapOf("brand_500" to 7, "brand_900" to 8), resourceId))
    }

    @Test
    fun resolvesSemanticColoursDirectlyOrThroughRawFallbacks() {
        val palette = Themes.Palette(
            semantic = mapOf("getBackgroundPrimary" to 1),
            rawFallbacks = mapOf("getTextNormal" to "brand_500", "getTextMuted" to "brand_900"),
        )
        val colorOf: (Int) -> Int? = { id -> if (id == 30) 99 else null }

        assertEquals(1, Themes.semanticColor(palette, "getBackgroundPrimary", resourceId, colorOf))
        assertEquals(99, Themes.semanticColor(palette, "getTextNormal", resourceId, colorOf))
        assertNull(Themes.semanticColor(palette, "getTextMuted", resourceId, colorOf))
        assertNull(Themes.semanticColor(palette, "getUnthemed", resourceId, colorOf))
    }
}
