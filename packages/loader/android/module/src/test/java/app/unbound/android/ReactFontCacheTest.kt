package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ReactFontCacheTest {
    // The shape of React Native's obfuscated font manager: a singleton in a static field of its own type.
    class FontManager {
        val families = LinkedHashMap<String, Any>()
        val typefaces = LinkedHashMap<String, Any>()
        val name = "not a cache"

        companion object {
            @JvmField val INSTANCE = FontManager()
        }
    }

    class NotASingleton {
        val families = LinkedHashMap<String, Any>()
    }

    @Test
    fun findsTheMapsOfASingletonOfItsOwnType() {
        val caches = ReactFontCache.cachesOf(FontManager::class.java)

        assertEquals(2, caches.size)
        assertTrue(caches.any { it === FontManager.INSTANCE.families })
        assertTrue(caches.any { it === FontManager.INSTANCE.typefaces })
    }

    @Test
    fun skipsClassesWithoutASingleton() {
        assertEquals(emptyList<Any>(), ReactFontCache.cachesOf(NotASingleton::class.java))
    }
}
