package app.unbound.manager.core

import org.junit.Assert.assertEquals
import org.junit.Test

class CheckPlanTest {
    private val alpha3531 = release("loader-v353.1-android-alpha", "b".repeat(64), updatedAt = 3_000)
    private val update = UpdateDecision.Available(alpha3531, listOf(alpha3531))
    private val ours = present("353.0 - Alpha", 2_000)
    private val adb = ours.copy(installer = null)

    private fun discord(
        decision: UpdateDecision = update,
        installed: InstalledPackageState = ours,
        record: TargetRecord = TargetRecord(),
    ) = Checked(Target.DISCORD, installed, decision, record)

    private fun plan(vararg targets: Checked, autoUpdate: Boolean = true) = planCheck(targets.toList(), autoUpdate, SELF)

    @Test
    fun `a new build of a package this app installed is installed unattended when auto update is on`() {
        assertEquals(listOf(CheckAction.Install(Target.DISCORD, update)), plan(discord()))
    }

    @Test
    fun `with auto update off the user is notified instead`() {
        assertEquals(listOf(CheckAction.Notify(Target.DISCORD, update)), plan(discord(), autoUpdate = false))
    }

    @Test
    fun `a package another installer put there is notified because Android would prompt`() {
        assertEquals(listOf(CheckAction.Notify(Target.DISCORD, update)), plan(discord(installed = adb)))
    }

    @Test
    fun `a failed install is not retried unattended but the new build is still announced`() {
        val failed = TargetRecord(Phase.Failed(alpha3531, Step.INSTALL, Failure.NotApplied))

        assertEquals(listOf(CheckAction.Notify(Target.DISCORD, update)), plan(discord(record = failed)))
    }

    @Test
    fun `a build already acted on is skipped, so each build is announced once`() {
        assertEquals(emptyList<CheckAction>(), plan(discord(record = TargetRecord(notifiedSha256 = alpha3531.asset.sha256))))
    }

    @Test
    fun `after a build lands, a downgrade below the announced build is offered again`() {
        val artifact = Artifact(alpha3531, 353_201, listOf("base.apk"), TRUSTED, verifiedAt = 1)
        val updated = TargetRecord(Phase.Confirming(artifact), notifiedSha256 = alpha3531.asset.sha256)
            .on(Event.Observed(present("353.1 - Alpha", 5_000, versionCode = 353_201)))

        assertEquals(listOf(CheckAction.Install(Target.DISCORD, update)), plan(discord(record = updated)))
    }

    @Test
    fun `a rebuild with a new digest is announced even though one was announced for the tag`() {
        val announced = TargetRecord(notifiedSha256 = "a".repeat(64))

        assertEquals(listOf(CheckAction.Install(Target.DISCORD, update)), plan(discord(record = announced)))
    }

    @Test
    fun `a target with an install running is left alone`() {
        val running = TargetRecord(Phase.Downloading(alpha3531))

        assertEquals(emptyList<CheckAction>(), plan(discord(record = running)))
    }

    @Test
    fun `only targets with a newer build get an action`() {
        val decisions = listOf(
            UpdateDecision.NoRelease,
            UpdateDecision.NotInstalled(alpha3531),
            UpdateDecision.UpToDate(alpha3531),
            UpdateDecision.Blocked(alpha3531, setOf(PLAY_STORE)),
        )

        assertEquals(emptyList<CheckAction>(), plan(*decisions.map { discord(decision = it) }.toTypedArray()))
    }

    @Test
    fun `each target is planned on its own`() {
        val manager = release("manager-v0.1.1", "e".repeat(64), 3_000, "unbound-manager.apk")
        val managerUpdate = UpdateDecision.Available(manager, listOf(manager))
        val self = Checked(Target.MANAGER, present("0.1.0", 1).copy(installer = null), managerUpdate, TargetRecord())

        assertEquals(
            listOf(CheckAction.Install(Target.DISCORD, update), CheckAction.Notify(Target.MANAGER, managerUpdate)),
            plan(discord(), self),
        )
    }
}

private const val SELF = "app.unbound.manager"
