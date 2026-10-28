package app.unbound.manager.core

import kotlinx.serialization.Serializable

@Serializable
data class TargetRecord(val phase: Phase = Phase.Idle, val installedFrom: InstalledFrom? = null, val notifiedSha256: String? = null)

@Serializable
data class Artifact(
    val release: Release,
    val versionCode: Long,
    val splits: List<String>,
    val signer: String,
    val verifiedAt: Long,
    val previousVersionCode: Long? = null,
)

enum class Step { DOWNLOAD, VERIFY, INSTALL, CONFIRM }

@Serializable
sealed interface Phase {
    @Serializable
    data object Idle : Phase

    @Serializable
    data class Downloading(val release: Release) : Phase

    @Serializable
    data class Verifying(val release: Release) : Phase

    @Serializable
    data class Committing(val artifact: Artifact) : Phase

    @Serializable
    data class Committed(val artifact: Artifact, val sessionId: Int, val at: Long) : Phase

    @Serializable
    data class AwaitingUser(val artifact: Artifact, val sessionId: Int) : Phase

    @Serializable
    data class Confirming(val artifact: Artifact) : Phase

    @Serializable
    data class Failed(val release: Release, val step: Step, val failure: Failure) : Phase
}

sealed interface Event {
    data class Start(val release: Release) : Event

    data object Cancel : Event

    data object Downloaded : Event

    data class Verified(
        val versionCode: Long,
        val splits: List<String>,
        val signer: String,
        val at: Long,
        val previousVersionCode: Long?,
    ) : Event

    data class SessionReady(val sessionId: Int, val at: Long) : Event

    data class NeedsUser(val sessionId: Int) : Event

    data class SessionFinished(val sessionId: Int) : Event

    data class Observed(val installed: InstalledPackageState) : Event

    data class Fail(val failure: Failure, val sessionId: Int? = null) : Event

    data object Recommit : Event
}

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
                Artifact(phase.release, event.versionCode, event.splits, event.signer, event.at, event.previousVersionCode),
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

private fun Release.failedAt(step: Step, event: Event.Fail, sessionId: Int?): Phase.Failed? =
    Phase.Failed(this, step, event.failure).takeIf { event.sessionId == null || event.sessionId == sessionId }

private fun TargetRecord.confirm(artifact: Artifact, installed: InstalledPackageState): TargetRecord {
    val landed = installed is InstalledPackageState.Present &&
        installed.versionCode == artifact.versionCode &&
        artifact.signer in installed.signers &&
        installed.lastUpdateTime >= artifact.verifiedAt

    if (!landed) return copy(phase = Phase.Failed(artifact.release, Step.CONFIRM, Failure.NotApplied))

    return copy(
        phase = Phase.Idle,
        installedFrom = InstalledFrom(artifact.release.asset.sha256, installed.lastUpdateTime),
        notifiedSha256 = null,
    )
}

enum class StepState { PENDING, RUNNING, DONE, FAILED }

data class StepStatus(val step: Step, val state: StepState)

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
