package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

class LauncherPackagesTest {
    @Test
    fun scopeListsDiscordAndEveryHookedLauncher() {
        val scope = File("src/main/resources/META-INF/xposed/scope.list").readLines().map(String::trim).filter(String::isNotEmpty)
        assertEquals(listOf(Unbound.DISCORD_PACKAGE) + LauncherPackages.HOOKED.toList(), scope)
    }
}
