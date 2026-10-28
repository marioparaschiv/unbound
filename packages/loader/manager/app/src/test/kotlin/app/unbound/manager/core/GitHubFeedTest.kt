package app.unbound.manager.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class GitHubFeedTest {
    private val feed = parseFeed(javaClass.getResource("/github-releases.json")!!.readText())

    private fun millis(text: String) = Instant.parse(text).toEpochMilli()

    @Test
    fun `alpha Discord releases come newest first with their digest, size and version`() {
        val releases = feed.releasesFor(Target.DISCORD, Channel.ALPHA)

        assertEquals(listOf("loader-v353.1-android-alpha", "loader-v353.0-android-alpha"), releases.map { it.tag })
        assertEquals(listOf("353.1", "353.0"), releases.map { it.version.toString() })
        assertEquals(
            Asset(
                name = "Unbound-alpha.apks",
                url = "https://github.com/marioparaschiv/unbound/releases/download/loader-v353.1-android-alpha/Unbound-alpha.apks",
                size = 144_988_812,
                sha256 = "8bf11167990c1450ae24657d106e2f98f65c22e8cc7800ad92cacd5997555661",
                updatedAt = millis("2026-10-27T15:41:07Z"),
            ),
            releases.first().asset,
        )
        assertEquals(millis("2026-10-27T15:41:00Z"), releases.first().publishedAt)
        assertTrue(releases.first().notes.startsWith("<!-- Release notes generated"))
    }

    @Test
    fun `each channel sees only its own Discord build`() {
        assertEquals(
            listOf("7662b5983d391ab1d8b38a5e367eef77b28a70002f123bb8953092ebbbec8107"),
            feed.releasesFor(Target.DISCORD, Channel.BETA).map { it.asset.sha256 },
        )
        assertEquals(emptyList<Release>(), feed.releasesFor(Target.DISCORD, Channel.STABLE))
    }

    @Test
    fun `the module follows the channel and carries the LSPosed apk`() {
        val module = feed.releasesFor(Target.MODULE, Channel.ALPHA)

        assertEquals(listOf("loader-v353.1-android-alpha", "loader-v353.0-android-alpha"), module.map { it.tag })
        assertTrue(module.all { it.asset.name == "app.unbound.android.lsposed.apk" })
        assertEquals(listOf("loader-v352.10-android-beta"), feed.releasesFor(Target.MODULE, Channel.BETA).map { it.tag })
    }

    @Test
    fun `drafts are dropped and nothing is a manager release yet`() {
        assertTrue(feed.releases.none { it.tag == "web-v0.10.0" })
        assertEquals(emptyList<Release>(), feed.releasesFor(Target.MANAGER, Channel.ALPHA))
    }

    @Test
    fun `a manager release is found by its tag on any channel`() {
        val manager = parseFeed(feedOf(published("manager-v0.2.0", false, asset("unbound-manager.apk", "1", "2026-10-28T00:00:00Z"))))

        for (channel in Channel.entries) {
            assertEquals(listOf("0.2.0"), manager.releasesFor(Target.MANAGER, channel).map { it.version.toString() })
        }
    }

    @Test
    fun `an asset without a sha256 digest is never offered`() {
        val undigested = parseFeed(
            feedOf(published("loader-v353.1-android-alpha", true, asset("Unbound-alpha.apks", null, "2026-10-28T00:00:00Z"))),
        )

        assertEquals(emptyList<Release>(), undigested.releasesFor(Target.DISCORD, Channel.ALPHA))
    }

    @Test
    fun `a rebuild sorts above a release published later because its asset is newer`() {
        val json = feedOf(
            published("loader-v353.1-android-alpha", true, asset("Unbound-alpha.apks", "1", "2026-10-27T00:00:00Z")),
            published("loader-v353.0-android-alpha", true, asset("Unbound-alpha.apks", "2", "2026-10-29T00:00:00Z")),
        )

        assertEquals(
            listOf("loader-v353.0-android-alpha", "loader-v353.1-android-alpha"),
            parseFeed(json).releasesFor(Target.DISCORD, Channel.ALPHA).map { it.tag },
        )
    }

    @Test
    fun `versions compare numerically and parse from versionName and tags`() {
        assertEquals(Version(listOf(353, 1)), Version.parse("353.1 - Alpha"))
        assertEquals(Version(listOf(353, 1)), Version.parse("353.1"))
        assertEquals(Version(listOf(352, 10)), Version.ofTag("loader-v352.10-android-beta"))
        assertEquals(null, Version.ofTag("avd-snapshot-20261027"))
        assertTrue(Version.parse("352.10")!! > Version.parse("352.9")!!)
        assertTrue(Version.parse("353.0")!! > Version.parse("352.10")!!)
    }

    private fun asset(name: String, digestFill: String?, updatedAt: String): String {
        val digest = digestFill?.let { "\"sha256:${it.repeat(64)}\"" } ?: "null"
        return """{"name":"$name","browser_download_url":"https://example.invalid/$name","size":1,"digest":$digest,""" +
            """"updated_at":"$updatedAt"}"""
    }

    private fun published(tag: String, prerelease: Boolean, asset: String): String =
        """{"tag_name":"$tag","name":"$tag","draft":false,"prerelease":$prerelease,"body":"",""" +
            """"published_at":"2026-10-28T00:00:00Z","assets":[$asset]}"""

    private fun feedOf(vararg releases: String): String = releases.joinToString(",", "[", "]")
}
