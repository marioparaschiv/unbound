package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class HostClassTest {
    private val classLoader = HostClassTest::class.java.classLoader!!

    @Test
    fun loadsTheFirstNameThatExists() {
        val hostClass = HostClass("java.lang.StringBuilder", "java.lang.String")

        assertEquals(StringBuilder::class.java, hostClass.load(classLoader))
    }

    @Test
    fun fallsBackWhenEarlierNamesAreMissing() {
        val hostClass = HostClass("com.discord.missing.ThemeManager", "java.lang.String")

        assertEquals(String::class.java, hostClass.load(classLoader))
    }

    @Test
    fun findReturnsNullWhenNoNameExists() {
        assertNull(HostClass("com.discord.missing.A", "com.discord.missing.B").find(classLoader))
    }

    @Test
    fun loadNamesEveryCandidateWhenNoneExists() {
        val failure = assertThrows(ClassNotFoundException::class.java) {
            HostClass("com.discord.missing.A", "com.discord.missing.B").load(classLoader)
        }

        assertEquals("com.discord.missing.A or com.discord.missing.B", failure.message)
    }
}
