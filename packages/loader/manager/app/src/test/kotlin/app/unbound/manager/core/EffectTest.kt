package app.unbound.manager.core

import org.junit.Assert.assertEquals
import org.junit.Test

class EffectTest {
    private val release = release("loader-v353.0-android-alpha", "a".repeat(64), updatedAt = 1_000)
    private val artifact = Artifact(release, versionCode = 353_200, splits = listOf("base.apk"), signer = TRUSTED, verifiedAt = 5_000)
    private val failed = Phase.Failed(release, Step.DOWNLOAD, Failure.Network("offline"))

    @Test
    fun `each persisted phase resumes the effect it names`() {
        assertEquals(Effect.Cleanup(keepDownloads = false), Phase.Idle.effect())
        assertEquals(Effect.Download(release), Phase.Downloading(release).effect())
        assertEquals(Effect.Verify(release), Phase.Verifying(release).effect())
        assertEquals(Effect.OpenSession(artifact), Phase.Committing(artifact).effect())
        assertEquals(Effect.Commit(7), Phase.Committed(artifact, 7, 6_000).effect())
        assertEquals(Effect.AwaitUser(7), Phase.AwaitingUser(artifact, 7).effect())
        assertEquals(Effect.Confirm, Phase.Confirming(artifact).effect())
        assertEquals(Effect.Cleanup(keepDownloads = true), failed.effect())
    }

    @Test
    fun `a committed session can no longer be cancelled, everything before it can`() {
        val cancellable =
            listOf(
                Phase.Downloading(release),
                Phase.Verifying(release),
                Phase.Committing(artifact),
                Phase.AwaitingUser(artifact, 7),
                failed,
            )
        val committed = listOf(Phase.Idle, Phase.Committed(artifact, 7, 6_000), Phase.Confirming(artifact))

        assertEquals(List(cancellable.size) { true }, cancellable.map { it.cancellable })
        assertEquals(List(committed.size) { false }, committed.map { it.cancellable })
    }

    @Test
    fun `only phases with pending work are resumed after a restart`() {
        assertEquals(false, Phase.Idle.inFlight)
        assertEquals(false, failed.inFlight)
        assertEquals(true, Phase.Committed(artifact, 7, 6_000).inFlight)
    }

    @Test
    fun `installer statuses become session events carrying the session id`() {
        assertEquals(Event.NeedsUser(7), sessionEvent(7, -1, null))
        assertEquals(Event.SessionFinished(7), sessionEvent(7, 0, "INSTALL_SUCCEEDED"))
        assertEquals(Event.Fail(Failure.InsufficientStorage, 7), sessionEvent(7, 6, null))
        assertEquals(Event.Fail(Failure.InstallerRejected(3, "aborted"), 7), sessionEvent(7, 3, "aborted"))
    }
}
