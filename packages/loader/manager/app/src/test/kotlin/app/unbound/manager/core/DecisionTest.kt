package app.unbound.manager.core

import org.junit.Assert.assertEquals
import org.junit.Test

class DecisionTest {
    private val alpha3531 = release("loader-v353.1-android-alpha", "b".repeat(64), updatedAt = 3_000)
    private val alpha3530 = release("loader-v353.0-android-alpha", "a".repeat(64), updatedAt = 2_000)
    private val releases = listOf(alpha3531, alpha3530)
    private val trusted = setOf(TRUSTED)

    private fun discord(installed: InstalledPackageState, from: InstalledFrom? = null, list: List<Release> = releases) =
        decide(Target.DISCORD, installed, from, list, trusted)

    @Test
    fun `a channel without releases offers nothing whether or not Discord is installed`() {
        assertEquals(UpdateDecision.NoRelease, discord(InstalledPackageState.Missing, list = emptyList()))
        assertEquals(UpdateDecision.NoRelease, discord(present("353.1 - Alpha", 5_000), list = emptyList()))
    }

    @Test
    fun `a missing package is offered the newest release`() {
        assertEquals(UpdateDecision.NotInstalled(alpha3531), discord(InstalledPackageState.Missing))
    }

    @Test
    fun `the tracked digest of the newest release is up to date`() {
        val decision = discord(present("353.1 - Alpha", 5_000), InstalledFrom(alpha3531.asset.sha256, 5_000))

        assertEquals(UpdateDecision.UpToDate(alpha3531), decision)
    }

    @Test
    fun `a tracked older digest is offered every newer release`() {
        val decision = discord(present("353.0 - Alpha", 2_500), InstalledFrom(alpha3530.asset.sha256, 2_500))

        assertEquals(UpdateDecision.Available(alpha3531, listOf(alpha3531)), decision)
    }

    @Test
    fun `a rebuild of the installed tag is available even though the version is the same`() {
        val rebuild = release("loader-v353.1-android-alpha", "c".repeat(64), updatedAt = 9_000)
        val decision = discord(
            present("353.1 - Alpha", 5_000),
            InstalledFrom(alpha3531.asset.sha256, 5_000),
            listOf(rebuild, alpha3530),
        )

        assertEquals(UpdateDecision.Available(rebuild, listOf(rebuild)), decision)
    }

    @Test
    fun `an install made outside the manager is compared by the Discord version in its versionName`() {
        assertEquals(UpdateDecision.Available(alpha3531, listOf(alpha3531)), discord(present("353.0 - Alpha", 99_000)))
        assertEquals(UpdateDecision.UpToDate(null), discord(present("353.1 - Alpha", 1)))
        assertEquals(UpdateDecision.UpToDate(null), discord(present("354.0", 1)))
    }

    @Test
    fun `a stale tracked digest whose package was reinstalled since falls back to the version`() {
        val decision = discord(present("353.0 - Alpha", 99_000), InstalledFrom(alpha3531.asset.sha256, 5_000))

        assertEquals(UpdateDecision.Available(alpha3531, listOf(alpha3531)), decision)
    }

    @Test
    fun `Play Store Discord is blocked because its signer is not trusted`() {
        val installed = present("353.1 - Stable", 1, signer = PLAY_STORE)

        assertEquals(UpdateDecision.Blocked(alpha3531, setOf(PLAY_STORE)), discord(installed))
        assertEquals(UpdateDecision.Blocked(null, setOf(PLAY_STORE)), discord(installed, list = emptyList()))
    }

    @Test
    fun `an outside module install is compared by install time because its versionName never changes`() {
        val module = listOf(release("loader-v353.1-android-alpha", "d".repeat(64), 3_000, "app.unbound.android.lsposed.apk"))

        assertEquals(
            UpdateDecision.Available(module.first(), module),
            decide(Target.MODULE, present("1.0.0", 2_999), null, module, trusted),
        )
        assertEquals(UpdateDecision.UpToDate(null), decide(Target.MODULE, present("1.0.0", 3_001), null, module, trusted))
    }

    @Test
    fun `the manager compares its own versionName with the release tag`() {
        val manager = listOf(release("manager-v0.2.0", "e".repeat(64), 3_000, "unbound-manager.apk"))

        assertEquals(
            UpdateDecision.Available(manager.first(), manager),
            decide(Target.MANAGER, present("0.1.0", 9_000), null, manager, trusted),
        )
        assertEquals(UpdateDecision.UpToDate(null), decide(Target.MANAGER, present("0.2.0", 1), null, manager, trusted))
    }
}
