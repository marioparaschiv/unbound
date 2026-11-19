package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Test

class ModuleStatusTest {
    private val active = FrameworkFacts(name = "LSPosed", version = "2.0", apiVersion = 101, scope = listOf("com.discord"))

    private fun input(framework: FrameworkFacts? = active, timedOut: Boolean = false, discord: String? = "353.0 (1)") =
        ModuleStatusInput("1.4.0 (abc)", framework, timedOut, discord)

    @Test
    fun reportsActiveWhenFrameworkScopesDiscord() {
        assertEquals("Unbound is active. Force-stop and reopen Discord after a module update.", ModuleStatus.summary(input()))
        assertEquals(listOf(StatusLevel.GOOD), ModuleStatus.rows(input()).map { it.level }.distinct())
    }

    @Test
    fun reportsInactiveFrameworkAfterTimeout() {
        assertEquals(
            "Unbound isn't active. Enable it in LSPosed or Vector, then reboot.",
            ModuleStatus.summary(input(null, timedOut = true)),
        )
        assertEquals(StatusLevel.BAD, ModuleStatus.rows(input(null, timedOut = true))[1].level)
    }

    @Test
    fun namesALegacyFrameworkThatCannotLoadTheModule() {
        val legacy = ModuleStatusInput("1.4.0 (abc)", null, true, "353.0 (1)", "EdXposed")

        assertEquals("EdXposed can't load Unbound. Install LSPosed or Vector instead, then reboot.", ModuleStatus.summary(legacy))
        assertEquals("EdXposed (unsupported)", ModuleStatus.rows(legacy)[1].value)
    }

    @Test
    fun waitsForTheFrameworkBeforeTheTimeout() {
        assertEquals("Checking the framework…", ModuleStatus.summary(input(null)))
    }

    @Test
    fun flagsMissingDiscordAndScope() {
        assertEquals("Install Discord to use Unbound.", ModuleStatus.summary(input(discord = null)))
        assertEquals("Add Discord to Unbound's scope in your framework.", ModuleStatus.summary(input(active.copy(scope = emptyList()))))
        assertEquals(StatusLevel.BAD, ModuleStatus.rows(input(active.copy(scope = emptyList())))[2].level)
    }

    @Test
    fun shortensFrameworkVersions() {
        assertEquals("2.2 (3080)", ModuleStatus.shortVersion("2.2 (3080) 88f8e1fa-JingMatrix-Vector"))
        assertEquals("1.9.2", ModuleStatus.shortVersion("1.9.2"))
    }
}
