package app.unbound.manager.core

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class PhaseTest {
    private val release = release("loader-v353.0-android-alpha", "a".repeat(64), updatedAt = 1_000)
    private val next = release("loader-v353.1-android-alpha", "b".repeat(64), updatedAt = 2_000)
    private val artifact = Artifact(release, versionCode = 353_200, splits = listOf("base.apk"), signer = TRUSTED, verifiedAt = 5_000)
    private val offline = Failure.Network("offline")
    private val base = TargetRecord(installedFrom = InstalledFrom("0".repeat(64), 1), notifiedSha256 = "f".repeat(64))

    private val idle = Phase.Idle
    private val downloading = Phase.Downloading(release)
    private val verifying = Phase.Verifying(release)
    private val committing = Phase.Committing(artifact)
    private val committed = Phase.Committed(artifact, sessionId = 7, at = 6_000)
    private val awaitingUser = Phase.AwaitingUser(artifact, sessionId = 7)
    private val confirming = Phase.Confirming(artifact)
    private val failed = Phase.Failed(release, Step.DOWNLOAD, offline)
    private val phases = listOf(idle, downloading, verifying, committing, committed, awaitingUser, confirming, failed)

    private val landed = present("353.0 - Alpha", lastUpdateTime = 7_000, versionCode = 353_200)
    private val start = Event.Start(next)
    private val verified = Event.Verified(353_200, listOf("base.apk"), TRUSTED, 5_000)
    private val ready = Event.SessionReady(7, 6_000)
    private val needsUser = Event.NeedsUser(7)
    private val staleNeedsUser = Event.NeedsUser(8)
    private val finished = Event.SessionFinished(7)
    private val staleFinished = Event.SessionFinished(8)
    private val observedLanded = Event.Observed(landed)
    private val observedMissing = Event.Observed(InstalledPackageState.Missing)
    private val observedOldBuild = Event.Observed(landed.copy(versionCode = 353_100))
    private val observedBeforeVerify = Event.Observed(landed.copy(lastUpdateTime = 4_999))
    private val observedOtherSigner = Event.Observed(landed.copy(signers = setOf(PLAY_STORE)))
    private val failRunner = Event.Fail(offline)
    private val failSession = Event.Fail(offline, sessionId = 7)
    private val failStaleSession = Event.Fail(offline, sessionId = 8)
    private val events = listOf(
        start, Event.Cancel, Event.Downloaded, verified, ready, needsUser, staleNeedsUser, finished, staleFinished,
        observedLanded, observedMissing, observedOldBuild, observedBeforeVerify, observedOtherSigner,
        failRunner, failSession, failStaleSession, Event.Recommit,
    )

    private fun record(phase: Phase) = base.copy(phase = phase)

    private fun notApplied() = record(Phase.Failed(release, Step.CONFIRM, Failure.NotApplied))

    /** Every accepted (phase, event) pair. Any pair not listed must leave the record unchanged. */
    private val accepted: List<Triple<Phase, Event, TargetRecord>> = listOf(
        Triple(idle, start, record(Phase.Downloading(next))),
        Triple(failed, start, record(Phase.Downloading(next))),
        Triple(downloading, Event.Downloaded, record(verifying)),
        Triple(downloading, failRunner, record(Phase.Failed(release, Step.DOWNLOAD, offline))),
        Triple(downloading, Event.Cancel, record(idle)),
        Triple(verifying, verified, record(committing)),
        Triple(verifying, failRunner, record(Phase.Failed(release, Step.VERIFY, offline))),
        Triple(verifying, Event.Cancel, record(idle)),
        Triple(committing, ready, record(committed)),
        Triple(committing, failRunner, record(Phase.Failed(release, Step.INSTALL, offline))),
        Triple(committing, Event.Cancel, record(idle)),
        Triple(committed, needsUser, record(awaitingUser)),
        Triple(committed, finished, record(confirming)),
        Triple(committed, failRunner, record(Phase.Failed(release, Step.INSTALL, offline))),
        Triple(committed, failSession, record(Phase.Failed(release, Step.INSTALL, offline))),
        Triple(awaitingUser, finished, record(confirming)),
        Triple(awaitingUser, failRunner, record(Phase.Failed(release, Step.INSTALL, offline))),
        Triple(awaitingUser, failSession, record(Phase.Failed(release, Step.INSTALL, offline))),
        Triple(awaitingUser, Event.Recommit, record(committing)),
        Triple(awaitingUser, Event.Cancel, record(idle)),
        Triple(
            confirming,
            observedLanded,
            TargetRecord(phase = idle, installedFrom = InstalledFrom(release.asset.sha256, 7_000), notifiedSha256 = null),
        ),
        Triple(confirming, observedMissing, notApplied()),
        Triple(confirming, observedOldBuild, notApplied()),
        Triple(confirming, observedBeforeVerify, notApplied()),
        Triple(confirming, observedOtherSigner, notApplied()),
        Triple(confirming, failRunner, record(Phase.Failed(release, Step.CONFIRM, offline))),
        Triple(failed, Event.Cancel, record(idle)),
    )

    @Test
    fun `every phase and event pair moves exactly as the table says`() {
        for (phase in phases) {
            for (event in events) {
                val expected = accepted.find { it.first == phase && it.second == event }?.third ?: record(phase)

                assertEquals("$phase + $event", expected, record(phase).on(event))
            }
        }
    }

    @Test
    fun `an install resumes and completes through the write-ahead session`() {
        val done = listOf(start, Event.Downloaded, verified, ready, needsUser, finished, observedLanded)
            .fold(TargetRecord()) { record, event -> record.on(event) }

        assertEquals(TargetRecord(phase = idle, installedFrom = InstalledFrom(next.asset.sha256, 7_000)), done)
    }

    @Test
    fun `the step list follows the phase`() {
        val p = StepState.PENDING
        val r = StepState.RUNNING
        val d = StepState.DONE
        val f = StepState.FAILED
        val expected = mapOf(
            idle to listOf(p, p, p, p),
            downloading to listOf(r, p, p, p),
            verifying to listOf(d, r, p, p),
            committing to listOf(d, d, r, p),
            committed to listOf(d, d, r, p),
            awaitingUser to listOf(d, d, r, p),
            confirming to listOf(d, d, d, r),
            failed to listOf(f, p, p, p),
            Phase.Failed(release, Step.INSTALL, offline) to listOf(d, d, f, p),
        )

        for ((phase, states) in expected) {
            assertEquals("$phase", Step.entries.zip(states).map { (step, state) -> StepStatus(step, state) }, phase.steps())
        }
    }

    @Test
    fun `every phase survives a round trip through the persisted JSON`() {
        for (phase in phases) {
            val stored = Json.encodeToString(TargetRecord.serializer(), record(phase))

            assertEquals(record(phase), Json.decodeFromString(TargetRecord.serializer(), stored))
        }
    }
}
