package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class DiscordInstallPlanTest {
    private fun split(name: String, hash: Char) = BuildSplit(name, "https://cdn.example/$name.apk.gz", hash.toString().repeat(64), 10, 5)

    private val build = listOf(split("base", 'a'), split("config.arm64_v8a", 'b'), split("config.xxhdpi", 'c'), split("config.en", 'd'))

    @Test
    fun aDifferentBuildReplacesEveryInstalledSplit() {
        val plan = DiscordInstallPlan.plan(mapOf("base" to "0".repeat(64), "config.arm64_v8a" to null, "config.xxhdpi" to null), build)

        assertEquals(listOf("base", "config.arm64_v8a", "config.xxhdpi"), plan.downloads.map { it.name })
        assertFalse(plan.inherit)
        assertEquals(15L, plan.downloadBytes)
    }

    @Test
    fun identicalSplitsAreInheritedInsteadOfDownloaded() {
        val plan = DiscordInstallPlan.plan(mapOf("base" to "0".repeat(64), "config.arm64_v8a" to "b".repeat(64)), build)

        assertEquals(listOf("base"), plan.downloads.map { it.name })
        assertTrue(plan.inherit)
    }

    @Test
    fun aBuildWithoutTheDevicesSplitIsRefused() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            DiscordInstallPlan.plan(mapOf("base" to null, "config.x86_64" to null), build)
        }

        assertEquals("This build has no config.x86_64 split for this device", error.message)
    }

    @Test
    fun parsesTheApiSplitsAndRejectsMalformedOnes() {
        val json = """[{"name":"base","url":"https://cdn.example/base.apk.gz","sha256":"${"a".repeat(
            64,
        )}","size":10.0,"compressedSize":5}]"""

        assertEquals(listOf(split("base", 'a')), DiscordInstallPlan.parseSplits(json))
        assertThrows(IllegalArgumentException::class.java) {
            DiscordInstallPlan.parseSplits(json.replace("https://", "file://"))
        }
        assertThrows(IllegalArgumentException::class.java) {
            DiscordInstallPlan.parseSplits(json.replace("\"base\"", "\"../base\""))
        }
    }
}
