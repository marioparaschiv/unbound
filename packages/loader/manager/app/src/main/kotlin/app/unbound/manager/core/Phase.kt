package app.unbound.manager.core

import kotlinx.serialization.Serializable

/** The single persisted record per target. At most one operation per target exists, and [phase] is it. */
@Serializable
data class TargetRecord(
    val phase: Phase = Phase.Idle,
    val installedFrom: InstalledFrom? = null,
    /** Asset digest the periodic check already announced or auto-installed, so it acts once per build. Cleared when a build lands. */
    val notifiedSha256: String? = null,
)

/** Verified, on-disk splits for one release. */
@Serializable
data class Artifact(
    val release: Release,
    val versionCode: Long,
    val splits: List<String>,
    /** The trusted signer digest the splits carry. */
    val signer: String,
    /** Epoch millis. An installed package updated after this with our versionCode and signer is this artifact. */
    val verifiedAt: Long,
)

enum class Step { DOWNLOAD, VERIFY, INSTALL, CONFIRM }

/** Write-ahead state: after process death the runner re-performs the effect the persisted phase names. */
@Serializable
sealed interface Phase {
    @Serializable
    data object Idle : Phase

    @Serializable
    data class Downloading(val release: Release) : Phase

    @Serializable
    data class Verifying(val release: Release) : Phase

    /** Any session for the package is an orphan from a crash and is abandoned before a new one is made. */
    @Serializable
    data class Committing(val artifact: Artifact) : Phase

    /** Written after every split is in session [sessionId] and before commit(), so a resume knows the session. */
    @Serializable
    data class Committed(val artifact: Artifact, val sessionId: Int, val at: Long) : Phase

    /** Got STATUS_PENDING_USER_ACTION. The confirm Intent lives in a notification, not here. */
    @Serializable
    data class AwaitingUser(val artifact: Artifact, val sessionId: Int) : Phase

    /** The session ended or vanished; PackageManager decides whether the artifact landed. */
    @Serializable
    data class Confirming(val artifact: Artifact) : Phase

    /** Terminal until the user retries or dismisses. */
    @Serializable
    data class Failed(val release: Release, val step: Step, val failure: Failure) : Phase
}

sealed interface Event {
    data class Start(val release: Release) : Event

    data object Cancel : Event

    data object Downloaded : Event

    data class Verified(val versionCode: Long, val splits: List<String>, val signer: String, val at: Long) : Event

    /** The runner wrote every split into [sessionId] and is about to commit it. */
    data class SessionReady(val sessionId: Int, val at: Long) : Event

    data class NeedsUser(val sessionId: Int) : Event

    /** A STATUS_SUCCESS broadcast, or the session vanished while the record still named it. */
    data class SessionFinished(val sessionId: Int) : Event

    /** What PackageManager shows for the package while confirming. */
    data class Observed(val installed: InstalledPackageState) : Event

    /** [sessionId] is set for installer results, so the result of an abandoned session cannot fail the live one. */
    data class Fail(val failure: Failure, val sessionId: Int? = null) : Event

    /** The confirm Intent is lost: abandon the session and commit a fresh one. */
    data object Recommit : Event
}

/**
 * The whole install state machine. Every writer goes through it, so any interleaving of runner,
 * receiver and UI events is decided here. An event that does not fit the phase returns this record.
 */
fun TargetRecord.on(event: Event): TargetRecord {
    val next: Phase = when (val phase = phase) {
        Phase.Idle -> when (event) {
            is Event.Start -> Phase.Downloading(event.release)
            else -> null
        }

        is Phase.Downloading -> when (event) {
            Event.Downloaded -> Phase.Verifying(phase.release)
            is Event.Fail -> phase.release.failedAt(Step.DOWNLOAD, event, null)
            Event.Cancel -> Phase.Idle
            else -> null
        }

        is Phase.Verifying -> when (event) {
            is Event.Verified -> Phase.Committing(
                Artifact(phase.release, event.versionCode, event.splits, event.signer, event.at),
            )

            is Event.Fail -> phase.release.failedAt(Step.VERIFY, event, null)

            Event.Cancel -> Phase.Idle

            else -> null
        }

        is Phase.Committing -> when (event) {
            is Event.SessionReady -> Phase.Committed(phase.artifact, event.sessionId, event.at)
            is Event.Fail -> phase.artifact.release.failedAt(Step.INSTALL, event, null)
            Event.Cancel -> Phase.Idle
            else -> null
        }

        is Phase.Committed -> when {
            event is Event.NeedsUser && event.sessionId == phase.sessionId -> Phase.AwaitingUser(phase.artifact, phase.sessionId)
            event is Event.SessionFinished && event.sessionId == phase.sessionId -> Phase.Confirming(phase.artifact)
            event is Event.Fail -> phase.artifact.release.failedAt(Step.INSTALL, event, phase.sessionId)
            else -> null
        }

        is Phase.AwaitingUser -> when {
            event is Event.SessionFinished && event.sessionId == phase.sessionId -> Phase.Confirming(phase.artifact)
            event is Event.Fail -> phase.artifact.release.failedAt(Step.INSTALL, event, phase.sessionId)
            event == Event.Recommit -> Phase.Committing(phase.artifact)
            event == Event.Cancel -> Phase.Idle
            else -> null
        }

        is Phase.Confirming -> when (event) {
            is Event.Observed -> return confirm(phase.artifact, event.installed)
            is Event.Fail -> phase.artifact.release.failedAt(Step.CONFIRM, event, null)
            else -> null
        }

        is Phase.Failed -> when (event) {
            is Event.Start -> Phase.Downloading(event.release)
            Event.Cancel -> Phase.Idle
            else -> null
        }
    } ?: return this

    return copy(phase = next)
}

/** A failure counts only when it carries no session id or the id of the session this phase owns. */
private fun Release.failedAt(step: Step, event: Event.Fail, sessionId: Int?): Phase.Failed? =
    Phase.Failed(this, step, event.failure).takeIf { event.sessionId == null || event.sessionId == sessionId }

private fun TargetRecord.confirm(artifact: Artifact, installed: InstalledPackageState): TargetRecord {
    val landed = installed is InstalledPackageState.Present &&
        installed.versionCode == artifact.versionCode &&
        artifact.signer in installed.signers &&
        installed.lastUpdateTime >= artifact.verifiedAt

    if (!landed) return copy(phase = Phase.Failed(artifact.release, Step.CONFIRM, Failure.NotApplied))

    // The announced build is consumed once a build lands, so a later downgrade is offered again.
    return copy(
        phase = Phase.Idle,
        installedFrom = InstalledFrom(artifact.release.asset.sha256, installed.lastUpdateTime),
        notifiedSha256 = null,
    )
}

enum class StepState { PENDING, RUNNING, DONE, FAILED }

data class StepStatus(val step: Step, val state: StepState)

/** The four-step list the installer screen renders, projected from the phase. */
fun Phase.steps(): List<StepStatus> {
    val (current, state) = when (this) {
        Phase.Idle -> return Step.entries.map { StepStatus(it, StepState.PENDING) }
        is Phase.Downloading -> Step.DOWNLOAD to StepState.RUNNING
        is Phase.Verifying -> Step.VERIFY to StepState.RUNNING
        is Phase.Committing, is Phase.Committed, is Phase.AwaitingUser -> Step.INSTALL to StepState.RUNNING
        is Phase.Confirming -> Step.CONFIRM to StepState.RUNNING
        is Phase.Failed -> step to StepState.FAILED
    }

    return Step.entries.map {
        val stepState = when {
            it < current -> StepState.DONE
            it == current -> state
            else -> StepState.PENDING
        }
        StepStatus(it, stepState)
    }
}
